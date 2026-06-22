/**
 * Conecta a Shopify usando o Access Token permanente existente e sincroniza
 * produtos + pedidos para o banco. Uso único / manutenção.
 *   node scripts/connect-and-sync.mjs
 */
import postgres from "postgres";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const STORE_ID = "00000000-0000-0000-0000-000000000010";
const API = "2024-10";
const TOKEN_FILE = path.resolve("../Documentos Plus Midia LLC/Shopify - Token Plus App.txt");

// ---- env ----
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// ---- crypto (igual src/lib/crypto.ts) ----
function encrypt(plain) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

// ---- ler token/domínio do arquivo ----
const txt = fs.readFileSync(TOKEN_FILE, "utf8");
const domain = txt.match(/Dom[ií]nio Shopify:\s*([^\s]+)/i)[1].trim();
const token = txt.match(/Access Token:\s*([^\s]+)/i)[1].trim();
console.log("Loja:", domain, "| token:", token.slice(0, 10) + "…");

// ---- helper de fetch paginado ----
async function getAll(resource, key, query = "") {
  const out = [];
  let url = `https://${domain}/admin/api/${API}/${resource}.json?limit=250${query ? "&" + query : ""}`;
  let guard = 0;
  while (url && guard++ < 60) {
    const res = await fetch(url, { headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`${resource} ${res.status}: ${await res.text()}`);
    const j = await res.json();
    out.push(...(j[key] || []));
    const link = res.headers.get("link");
    const m = link && link.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  return out;
}

async function run() {
  // salva conexão
  const creds = { domain, tokenEnc: encrypt(token), _detail: `Conectado: ${domain}` };
  await sql`
    insert into connections (store_id, provider, credentials, status, last_synced_at)
    values (${STORE_ID}, 'shopify', ${sql.json(creds)}, 'connected', now())
    on conflict (store_id, provider) do update set credentials = ${sql.json(creds)}, status='connected', last_synced_at=now()
  `;
  console.log("✅ conexão salva");

  // produtos
  const products = await getAll("products", "products", "status=active");
  console.log("produtos:", products.length);
  const invToVariant = new Map();
  for (const p of products) {
    await sql`insert into products (id, store_id, title, image, status)
      values (${String(p.id)}, ${STORE_ID}, ${p.title}, ${p.image?.src ?? null}, ${p.status})
      on conflict (id) do update set title=excluded.title, image=excluded.image, status=excluded.status`;
    for (const v of p.variants) {
      await sql`insert into product_variants (id, product_id, store_id, title, sku, price)
        values (${String(v.id)}, ${String(p.id)}, ${STORE_ID}, ${v.title}, ${v.sku ?? null}, ${Number(v.price) || 0})
        on conflict (id) do update set product_id=excluded.product_id, title=excluded.title, sku=excluded.sku, price=excluded.price`;
      if (v.inventory_item_id) invToVariant.set(v.inventory_item_id, v.id);
    }
  }

  // custos (inventory items)
  const invIds = [...invToVariant.keys()];
  let costCount = 0;
  for (let i = 0; i < invIds.length; i += 100) {
    const chunk = invIds.slice(i, i + 100);
    const items = await getAll("inventory_items", "inventory_items", `ids=${chunk.join(",")}`);
    for (const it of items) {
      if (it.cost != null) {
        await sql`update product_variants set cost=${Number(it.cost)}, cost_source='shopify', updated_at=now()
                  where id=${String(invToVariant.get(it.id))} and cost_source <> 'manual'`;
        costCount++;
      }
    }
  }
  console.log("variantes com custo do Shopify:", costCount);

  // pedidos (90 dias)
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 90);
  const orders = await getAll("orders", "orders", `status=any&created_at_min=${encodeURIComponent(since.toISOString())}`);
  console.log("pedidos (90d):", orders.length);
  const variants = await sql`select id, cost from product_variants where store_id=${STORE_ID}`;
  const costByVariant = new Map(variants.map((v) => [v.id, Number(v.cost)]));
  for (const o of orders) {
    const total = Number(o.total_price) || 0;
    const current = Number(o.current_total_price ?? o.total_price) || 0;
    const refunded = Math.max(0, total - current);
    await sql`insert into orders (id, store_id, order_name, created_at_shop, processed_at, financial_status,
        total, subtotal, total_discounts, total_tax, currency, gateway, refunded_amount)
      values (${String(o.id)}, ${STORE_ID}, ${o.name}, ${o.created_at}, ${o.processed_at ?? o.created_at},
        ${o.financial_status}, ${total}, ${Number(o.subtotal_price) || 0}, ${Number(o.total_discounts) || 0},
        ${Number(o.total_tax) || 0}, ${o.currency}, ${o.payment_gateway_names?.[0] ?? null}, ${refunded})
      on conflict (id) do update set order_name=excluded.order_name, processed_at=excluded.processed_at,
        financial_status=excluded.financial_status, total=excluded.total, subtotal=excluded.subtotal,
        total_discounts=excluded.total_discounts, total_tax=excluded.total_tax, gateway=excluded.gateway,
        refunded_amount=excluded.refunded_amount`;
    await sql`delete from order_items where order_id=${String(o.id)}`;
    for (const li of o.line_items) {
      const unitCost = li.variant_id != null ? (costByVariant.get(String(li.variant_id)) ?? 0) : 0;
      await sql`insert into order_items (order_id, store_id, product_id, variant_id, title, quantity, unit_price, unit_cost)
        values (${String(o.id)}, ${STORE_ID}, ${li.product_id != null ? String(li.product_id) : null},
          ${li.variant_id != null ? String(li.variant_id) : null}, ${li.title}, ${li.quantity},
          ${Number(li.price) || 0}, ${unitCost})`;
    }
  }
  await sql`update connections set last_synced_at=now() where store_id=${STORE_ID} and provider='shopify'`;

  // resumo
  const [{ count: oc }] = await sql`select count(*)::int as count from orders where store_id=${STORE_ID}`;
  const [{ count: pc }] = await sql`select count(*)::int as count from products where store_id=${STORE_ID}`;
  console.log(`\n🎯 OK — ${pc} produtos, ${oc} pedidos no banco.`);
  await sql.end();
}

run().catch(async (e) => { console.error("❌", e.message); await sql.end(); process.exit(1); });
