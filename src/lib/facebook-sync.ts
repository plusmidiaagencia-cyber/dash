/** Sincronização Facebook Ads → banco (gasto diário + funil do pixel). */
import { sql } from "@/db";
import { getProviderCreds } from "./data";
import { getRate, type Currency } from "./fx";

const ACTION_MAP: Record<string, string[]> = {
  pageViews: ["landing_page_view"],
  viewContent: ["view_content", "omni_view_content", "offsite_conversion.fb_pixel_view_content"],
  addToCart: ["add_to_cart", "omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"],
  initiateCheckout: ["initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout"],
  purchases: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"],
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

type Insight = { date_start: string; spend?: string; actions?: { action_type: string; value: string }[] };

export async function syncFacebook(storeId: string, sinceDays = 90): Promise<number> {
  const c = await getProviderCreds(storeId, "facebook");
  if (!c) throw new Error("Facebook não conectado");
  const token = c.token;
  const acct = (c.accountId || "").startsWith("act_") ? c.accountId : `act_${c.accountId}`;
  const ver = c.apiVersion || "v21.0";
  const s = sql();

  // moeda da conta → converte p/ GBP (base do painel)
  let rate = 1;
  try {
    const ar = await fetch(`https://graph.facebook.com/${ver}/${acct}?fields=currency&access_token=${token}`, { cache: "no-store" });
    const aj = await ar.json();
    const cur = (aj.currency || "GBP") as Currency;
    if (cur !== "GBP") rate = (await getRate(cur, "GBP")) ?? 1;
  } catch {
    /* mantém rate=1 */
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - sinceDays);
  const range = JSON.stringify({ since: iso(since), until: iso(new Date()) });
  let url: string | null =
    `https://graph.facebook.com/${ver}/${acct}/insights?fields=spend,actions&time_increment=1&time_range=${encodeURIComponent(range)}&limit=500&access_token=${token}`;

  const rows: Insight[] = [];
  let guard = 0;
  while (url && guard++ < 30) {
    const res: Response = await fetch(url, { cache: "no-store" });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message);
    rows.push(...((j.data as Insight[]) || []));
    url = j.paging?.next || null;
  }

  for (const d of rows) {
    const acts: Record<string, number> = {};
    for (const a of d.actions || []) acts[a.action_type] = Number(a.value) || 0;
    const pick = (keys: string[]) => keys.reduce((sum, k) => sum + (acts[k] || 0), 0);
    const spendGbp = Math.round((Number(d.spend) || 0) * rate * 100) / 100;
    await s`
      insert into ad_spend_daily (store_id, date, spend, page_views, view_content, add_to_cart, initiate_checkout, purchases, updated_at)
      values (${storeId}, ${d.date_start}, ${spendGbp}, ${pick(ACTION_MAP.pageViews)}, ${pick(ACTION_MAP.viewContent)},
        ${pick(ACTION_MAP.addToCart)}, ${pick(ACTION_MAP.initiateCheckout)}, ${pick(ACTION_MAP.purchases)}, now())
      on conflict (store_id, date) do update set
        spend = excluded.spend, page_views = excluded.page_views, view_content = excluded.view_content,
        add_to_cart = excluded.add_to_cart, initiate_checkout = excluded.initiate_checkout,
        purchases = excluded.purchases, updated_at = now()
    `;
  }
  await s`update connections set last_synced_at = now() where store_id = ${storeId} and provider = 'facebook'`;
  return rows.length;
}
