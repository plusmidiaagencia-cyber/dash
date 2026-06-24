/** Conecta o Facebook Ads usando os tokens do agente e sincroniza gasto/funil. */
import postgres from "postgres";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const STORE_ID = "00000000-0000-0000-0000-000000000010";
const ACCOUNT = "act_1001468169278058"; // conta "Hargrove" (com cartão)
const AGENT_ENV = path.resolve("../Hargrove Agent/.env");

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

function encrypt(plain) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

const agent = {};
for (const l of fs.readFileSync(AGENT_ENV, "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) agent[m[1]] = m[2].trim();
}
const token = agent.META_ACCESS_TOKEN;
const pixel = agent.META_PIXEL_ID || "";
const ver = agent.META_API_VERSION || "v21.0";

async function run() {
  // valida
  const vr = await fetch(`https://graph.facebook.com/${ver}/${ACCOUNT}?fields=name,currency&access_token=${token}`);
  const vj = await vr.json();
  if (vj.error) throw new Error(vj.error.message);
  console.log("conta:", vj.name, "| moeda:", vj.currency);

  // converte a moeda da conta (ex.: USD) -> GBP (base do painel)
  let rate = 1;
  if (vj.currency && vj.currency !== "GBP") {
    const fr = await fetch(`https://open.er-api.com/v6/latest/${vj.currency}`);
    const fj = await fr.json();
    rate = fj?.rates?.GBP || 1;
    console.log(`taxa ${vj.currency}->GBP:`, rate);
  }

  const creds = {
    accountId: ACCOUNT, pixelId: pixel, apiVersion: ver,
    tokenEnc: encrypt(token), _detail: `Conectado: ${vj.name?.trim()} (${vj.currency})`,
  };
  await sql`
    insert into connections (store_id, provider, credentials, status, last_synced_at)
    values (${STORE_ID}, 'facebook', ${sql.json(creds)}, 'connected', now())
    on conflict (store_id, provider) do update set credentials=${sql.json(creds)}, status='connected', last_synced_at=now()
  `;
  console.log("✅ conexão salva");

  // insights (gasto + funil) últimos 90d
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 90);
  const iso = (d) => d.toISOString().slice(0, 10);
  const range = JSON.stringify({ since: iso(since), until: iso(new Date()) });
  let url = `https://graph.facebook.com/${ver}/${ACCOUNT}/insights?fields=spend,actions&time_increment=1&time_range=${encodeURIComponent(range)}&limit=500&access_token=${token}`;
  const rows = [];
  let guard = 0;
  while (url && guard++ < 30) {
    const r = await fetch(url); const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    rows.push(...(j.data || [])); url = j.paging?.next || null;
  }
  const MAP = {
    pv: ["landing_page_view"], vc: ["view_content", "omni_view_content", "offsite_conversion.fb_pixel_view_content"],
    atc: ["add_to_cart", "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"],
    ic: ["initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout"],
    pu: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"],
  };
  for (const d of rows) {
    const a = {}; for (const x of (d.actions || [])) a[x.action_type] = Number(x.value) || 0;
    const pick = (k) => k.reduce((s, x) => s + (a[x] || 0), 0);
    await sql`insert into ad_spend_daily (store_id, date, spend, page_views, view_content, add_to_cart, initiate_checkout, purchases, updated_at)
      values (${STORE_ID}, ${d.date_start}, ${(Number(d.spend) || 0) * rate}, ${pick(MAP.pv)}, ${pick(MAP.vc)}, ${pick(MAP.atc)}, ${pick(MAP.ic)}, ${pick(MAP.pu)}, now())
      on conflict (store_id, date) do update set spend=excluded.spend, page_views=excluded.page_views, view_content=excluded.view_content, add_to_cart=excluded.add_to_cart, initiate_checkout=excluded.initiate_checkout, purchases=excluded.purchases, updated_at=now()`;
  }
  console.log(`✅ insights: ${rows.length} dias com dados`);
  const [{ s }] = await sql`select coalesce(sum(spend),0)::float as s from ad_spend_daily where store_id=${STORE_ID}`;
  console.log("gasto total no banco:", s);
  await sql.end();
}
run().catch(async (e) => { console.error("❌", e.message); await sql.end(); process.exit(1); });
