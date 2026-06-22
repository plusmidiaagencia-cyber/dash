/** Sincronização Shopify → banco (produtos, custos e pedidos). */
import { sql } from "@/db";
import { getProviderCreds } from "./data";

const API = "2024-10";

type ShopifyCreds = { domain: string; token: string };

async function getCreds(storeId: string): Promise<ShopifyCreds | null> {
  const c = await getProviderCreds(storeId, "shopify");
  if (!c || !c.domain) return null;
  return { domain: c.domain.replace(/^https?:\/\//, "").replace(/\/$/, ""), token: c.token };
}

/** GET paginado (cursor via Link header) no Admin API. */
async function getAll<T>(creds: ShopifyCreds, resource: string, key: string, query = ""): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `https://${creds.domain}/admin/api/${API}/${resource}.json?limit=250${query ? "&" + query : ""}`;
  let guard = 0;
  while (url && guard++ < 50) {
    const res: Response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": creds.token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Shopify ${resource} ${res.status}`);
    const j = await res.json();
    out.push(...((j[key] as T[]) || []));
    const link = res.headers.get("link") || res.headers.get("Link");
    const m = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = m ? m[1] : null;
  }
  return out;
}

type SVariant = { id: number; title: string; sku: string; price: string; inventory_item_id: number };
type SProduct = { id: number; title: string; status: string; image?: { src: string }; variants: SVariant[] };
type SInvItem = { id: number; cost: string | null };

export async function syncProducts(storeId: string): Promise<number> {
  const creds = await getCreds(storeId);
  if (!creds) throw new Error("Shopify não conectado");
  const s = sql();

  const products = await getAll<SProduct>(creds, "products", "products", "status=active");

  for (const p of products) {
    await s`
      insert into products (id, store_id, title, image, status)
      values (${String(p.id)}, ${storeId}, ${p.title}, ${p.image?.src ?? null}, ${p.status})
      on conflict (id) do update set title = excluded.title, image = excluded.image, status = excluded.status
    `;
    for (const v of p.variants) {
      await s`
        insert into product_variants (id, product_id, store_id, title, sku, price)
        values (${String(v.id)}, ${String(p.id)}, ${storeId}, ${v.title}, ${v.sku ?? null}, ${Number(v.price) || 0})
        on conflict (id) do update set
          product_id = excluded.product_id, title = excluded.title, sku = excluded.sku, price = excluded.price
      `;
    }
  }

  // custos do Shopify (inventory items) — preenche cost onde não houver override manual
  const invIds = products.flatMap((p) => p.variants.map((v) => v.inventory_item_id)).filter(Boolean);
  const byVariantInv = new Map<number, number>(); // inventory_item_id -> variant_id
  for (const p of products) for (const v of p.variants) byVariantInv.set(v.inventory_item_id, v.id);

  for (let i = 0; i < invIds.length; i += 100) {
    const chunk = invIds.slice(i, i + 100);
    const items = await getAll<SInvItem>(creds, "inventory_items", "inventory_items", `ids=${chunk.join(",")}`);
    for (const it of items) {
      const cost = it.cost != null ? Number(it.cost) : null;
      const variantId = byVariantInv.get(it.id);
      if (cost != null && variantId != null) {
        await s`
          update product_variants set cost = ${cost}, cost_source = 'shopify', updated_at = now()
          where id = ${String(variantId)} and cost_source <> 'manual'
        `;
      }
    }
  }
  return products.length;
}

type SLineItem = { product_id: number | null; variant_id: number | null; title: string; quantity: number; price: string };
type SOrder = {
  id: number; name: string; created_at: string; processed_at: string | null;
  financial_status: string; currency: string;
  total_price: string; current_total_price: string; subtotal_price: string;
  total_discounts: string; total_tax: string;
  payment_gateway_names: string[]; line_items: SLineItem[];
};

export async function syncOrders(storeId: string, sinceDays = 90): Promise<number> {
  const creds = await getCreds(storeId);
  if (!creds) throw new Error("Shopify não conectado");
  const s = sql();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - sinceDays);
  const orders = await getAll<SOrder>(
    creds, "orders", "orders",
    `status=any&created_at_min=${encodeURIComponent(since.toISOString())}`
  );

  // mapa de custos por variante
  const variants = await s<{ id: string; cost: string }[]>`select id, cost from product_variants where store_id = ${storeId}`;
  const costByVariant = new Map(variants.map((v) => [v.id, Number(v.cost)]));

  for (const o of orders) {
    const total = Number(o.total_price) || 0;
    const current = Number(o.current_total_price ?? o.total_price) || 0;
    const refunded = Math.max(0, total - current);
    await s`
      insert into orders (id, store_id, order_name, created_at_shop, processed_at, financial_status,
        total, subtotal, total_discounts, total_tax, currency, gateway, refunded_amount)
      values (${String(o.id)}, ${storeId}, ${o.name}, ${o.created_at}, ${o.processed_at ?? o.created_at},
        ${o.financial_status}, ${total}, ${Number(o.subtotal_price) || 0}, ${Number(o.total_discounts) || 0},
        ${Number(o.total_tax) || 0}, ${o.currency}, ${o.payment_gateway_names?.[0] ?? null}, ${refunded})
      on conflict (id) do update set
        order_name = excluded.order_name, processed_at = excluded.processed_at,
        financial_status = excluded.financial_status, total = excluded.total, subtotal = excluded.subtotal,
        total_discounts = excluded.total_discounts, total_tax = excluded.total_tax,
        gateway = excluded.gateway, refunded_amount = excluded.refunded_amount
    `;
    await s`delete from order_items where order_id = ${String(o.id)}`;
    for (const li of o.line_items) {
      const unitCost = li.variant_id != null ? costByVariant.get(String(li.variant_id)) ?? 0 : 0;
      await s`
        insert into order_items (order_id, store_id, product_id, variant_id, title, quantity, unit_price, unit_cost)
        values (${String(o.id)}, ${storeId}, ${li.product_id != null ? String(li.product_id) : null},
          ${li.variant_id != null ? String(li.variant_id) : null}, ${li.title}, ${li.quantity},
          ${Number(li.price) || 0}, ${unitCost})
      `;
    }
  }
  return orders.length;
}

export async function runFullSync(storeId: string): Promise<{ products: number; orders: number }> {
  const products = await syncProducts(storeId);
  const orders = await syncOrders(storeId);
  const s = sql();
  await s`update connections set last_synced_at = now() where store_id = ${storeId} and provider = 'shopify'`;
  return { products, orders };
}
