/** Camada de dados do servidor — leituras/escritas no Postgres. */
import { sql } from "@/db";
import { encrypt, decrypt } from "./crypto";
import type { CostSettings } from "./metrics";

/** Credenciais descriptografadas de um provider (uso interno no servidor). */
export async function getProviderCreds(
  storeId: string,
  provider: "shopify" | "facebook"
): Promise<(Record<string, string> & { token: string }) | null> {
  const s = sql();
  const [row] = await s<{ credentials: Record<string, string> }[]>`
    select credentials from connections where store_id = ${storeId} and provider = ${provider}`;
  if (!row?.credentials?.tokenEnc) return null;
  const { tokenEnc, _detail, ...rest } = row.credentials;
  void _detail;
  return { ...rest, token: decrypt(tokenEnc) };
}

export type ConnStatus = {
  provider: "shopify" | "facebook";
  status: "connected" | "error" | "disconnected";
  detail: string;
  info: Record<string, string>; // campos não-secretos (domínio, conta, etc.)
  lastSyncedAt: string | null;
};

export async function getConnections(storeId: string): Promise<Record<string, ConnStatus>> {
  const s = sql();
  const rows = await s<
    { provider: string; status: string; credentials: Record<string, unknown>; last_synced_at: string | null }[]
  >`select provider, status, credentials, last_synced_at from connections where store_id = ${storeId}`;
  const out: Record<string, ConnStatus> = {};
  for (const r of rows) {
    const c = r.credentials || {};
    const info: Record<string, string> = {};
    for (const k of ["domain", "accountId", "pixelId", "apiVersion"]) {
      if (typeof c[k] === "string") info[k] = c[k] as string;
    }
    out[r.provider] = {
      provider: r.provider as "shopify" | "facebook",
      status: r.status as ConnStatus["status"],
      detail: (c._detail as string) || "",
      info,
      lastSyncedAt: r.last_synced_at,
    };
  }
  return out;
}

export async function saveConnection(
  storeId: string,
  provider: "shopify" | "facebook",
  publicFields: Record<string, string>,
  token: string | null,
  status: "connected" | "error",
  detail: string
) {
  const s = sql();
  const creds: Record<string, string> = { ...publicFields, _detail: detail };
  if (token) creds.tokenEnc = encrypt(token);
  const lastSynced = status === "connected" ? new Date().toISOString() : null;
  await s`
    insert into connections (store_id, provider, credentials, status, last_synced_at)
    values (${storeId}, ${provider}, ${s.json(creds)}, ${status}, ${lastSynced})
    on conflict (store_id, provider) do update
      set credentials = ${s.json(creds)}, status = ${status}, last_synced_at = ${lastSynced}
  `;
}

// ===== Shopify OAuth (Client ID + Secret) =====

export async function saveShopifyOAuthStart(
  storeId: string,
  v: { domain: string; clientId: string; clientSecret: string; shopifyPayments: boolean; state: string }
) {
  const s = sql();
  const creds: Record<string, string> = {
    domain: v.domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    clientId: v.clientId,
    clientSecretEnc: encrypt(v.clientSecret),
    shopifyPayments: v.shopifyPayments ? "1" : "0",
    state: v.state,
    _detail: "Aguardando autorização no Shopify…",
  };
  await s`
    insert into connections (store_id, provider, credentials, status)
    values (${storeId}, 'shopify', ${s.json(creds)}, 'connecting')
    on conflict (store_id, provider) do update set credentials = ${s.json(creds)}, status = 'connecting'
  `;
}

export async function getShopifyOAuth(storeId: string) {
  const s = sql();
  const [row] = await s<{ credentials: Record<string, string> }[]>`
    select credentials from connections where store_id = ${storeId} and provider = 'shopify'`;
  const c = row?.credentials;
  if (!c?.clientId || !c?.clientSecretEnc) return null;
  return {
    domain: c.domain,
    clientId: c.clientId,
    clientSecret: decrypt(c.clientSecretEnc),
    state: c.state,
    shopifyPayments: c.shopifyPayments === "1",
  };
}

export async function saveShopifyToken(storeId: string, token: string, detail: string) {
  const s = sql();
  const [row] = await s<{ credentials: Record<string, string> }[]>`
    select credentials from connections where store_id = ${storeId} and provider = 'shopify'`;
  const creds = { ...(row?.credentials || {}), tokenEnc: encrypt(token), _detail: detail };
  await s`
    update connections set credentials = ${s.json(creds)}, status = 'connected', last_synced_at = now()
    where store_id = ${storeId} and provider = 'shopify'
  `;
}

export async function getStore(storeId: string) {
  const s = sql();
  const [row] = await s<{ name: string; currency: string; revenue_goal: string }[]>`
    select name, currency, revenue_goal from stores where id = ${storeId}`;
  return row ? { name: row.name, currency: row.currency, revenueGoal: Number(row.revenue_goal) } : null;
}

export async function saveStoreGoal(storeId: string, revenueGoal: number) {
  const s = sql();
  await s`update stores set revenue_goal = ${revenueGoal} where id = ${storeId}`;
}

export async function getCostSettings(storeId: string): Promise<CostSettings> {
  const s = sql();
  const [c] = await s<
    { monthly_operational: string; shipping_mode: string; shipping_value: string; gateway_fee_percent_fallback: string }[]
  >`select monthly_operational, shipping_mode, shipping_value, gateway_fee_percent_fallback from cost_settings where store_id = ${storeId}`;
  const store = await getStore(storeId);
  return {
    monthlyOperational: c ? Number(c.monthly_operational) : 0,
    shippingMode: (c?.shipping_mode as CostSettings["shippingMode"]) ?? "none",
    shippingValue: c ? Number(c.shipping_value) : 0,
    gatewayFeePercentFallback: c ? Number(c.gateway_fee_percent_fallback) : 0.029,
    revenueGoal: store?.revenueGoal ?? 0,
  };
}

export async function saveCostSettings(
  storeId: string,
  v: { monthlyOperational: number; shippingMode: string; shippingValue: number; gatewayFeePercentFallback: number }
) {
  const s = sql();
  await s`
    insert into cost_settings (store_id, monthly_operational, shipping_mode, shipping_value, gateway_fee_percent_fallback, updated_at)
    values (${storeId}, ${v.monthlyOperational}, ${v.shippingMode}, ${v.shippingValue}, ${v.gatewayFeePercentFallback}, now())
    on conflict (store_id) do update set
      monthly_operational = ${v.monthlyOperational},
      shipping_mode = ${v.shippingMode},
      shipping_value = ${v.shippingValue},
      gateway_fee_percent_fallback = ${v.gatewayFeePercentFallback},
      updated_at = now()
  `;
}

export type Adjustment = { id: number; date: string; label: string; amount: number };

export async function listAdjustments(storeId: string): Promise<Adjustment[]> {
  const s = sql();
  const rows = await s<{ id: number; date: string; label: string; amount: string }[]>`
    select id, date, label, amount from manual_adjustments where store_id = ${storeId} order by date desc limit 50`;
  return rows.map((r) => ({ id: r.id, date: r.date, label: r.label, amount: Number(r.amount) }));
}

export async function addAdjustment(storeId: string, date: string, label: string, amount: number) {
  const s = sql();
  await s`insert into manual_adjustments (store_id, date, label, amount) values (${storeId}, ${date}, ${label}, ${amount})`;
}

export async function deleteAdjustment(storeId: string, id: number) {
  const s = sql();
  await s`delete from manual_adjustments where store_id = ${storeId} and id = ${id}`;
}

// ===== Produtos & custos =====

export type ProductRow = {
  id: string; title: string; image: string | null;
  variantsTotal: number; variantsWithCost: number;
  totalSales: number; costMin: number; costMax: number; lastCost: string | null;
};

export async function listProductsWithStats(storeId: string): Promise<ProductRow[]> {
  const s = sql();
  const rows = await s<
    {
      id: string; title: string; image: string | null;
      variants_total: number; variants_with_cost: number;
      cost_min: string; cost_max: string; last_cost: string | null; total_sales: string;
    }[]
  >`
    select p.id, p.title, p.image,
      count(v.id) as variants_total,
      count(v.id) filter (where v.cost > 0) as variants_with_cost,
      coalesce(min(v.cost), 0) as cost_min,
      coalesce(max(v.cost), 0) as cost_max,
      max(v.updated_at)::text as last_cost,
      coalesce((select sum(oi.quantity) from order_items oi where oi.product_id = p.id), 0) as total_sales
    from products p
    left join product_variants v on v.product_id = p.id
    where p.store_id = ${storeId}
    group by p.id, p.title, p.image
    order by total_sales desc, p.title asc
  `;
  return rows.map((r) => ({
    id: r.id, title: r.title, image: r.image,
    variantsTotal: Number(r.variants_total), variantsWithCost: Number(r.variants_with_cost),
    totalSales: Number(r.total_sales), costMin: Number(r.cost_min), costMax: Number(r.cost_max),
    lastCost: r.last_cost,
  }));
}

export async function setProductCost(storeId: string, productId: string, cost: number) {
  const s = sql();
  await s`update product_variants set cost = ${cost}, cost_source = 'manual', updated_at = now()
          where store_id = ${storeId} and product_id = ${productId}`;
}

export async function applyCostToAll(storeId: string, cost: number) {
  const s = sql();
  await s`update product_variants set cost = ${cost}, cost_source = 'manual', updated_at = now()
          where store_id = ${storeId}`;
}

// ===== Pedidos =====

export type OrderRow = {
  id: string; name: string; processedAt: string | null; status: string | null; gateway: string | null;
  revenue: number; cogs: number; tax: number; units: number; itemCount: number;
};

export async function listOrders(storeId: string, limit = 100): Promise<OrderRow[]> {
  const s = sql();
  const rows = await s<
    {
      id: string; order_name: string | null; processed_at: string | null; financial_status: string | null;
      gateway: string | null; total: string; refunded_amount: string; total_tax: string;
      cogs: string; units: string; item_count: string;
    }[]
  >`
    select o.id, o.order_name, o.processed_at::text, o.financial_status, o.gateway,
      o.total, o.refunded_amount, o.total_tax,
      coalesce((select sum(oi.unit_cost * oi.quantity) from order_items oi where oi.order_id = o.id), 0) as cogs,
      coalesce((select sum(oi.quantity) from order_items oi where oi.order_id = o.id), 0) as units,
      coalesce((select count(*) from order_items oi where oi.order_id = o.id), 0) as item_count
    from orders o
    where o.store_id = ${storeId}
    order by o.processed_at desc nulls last
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.order_name || `#${r.id}`,
    processedAt: r.processed_at,
    status: r.financial_status,
    gateway: r.gateway,
    revenue: Number(r.total) - Number(r.refunded_amount),
    cogs: Number(r.cogs),
    tax: Number(r.total_tax),
    units: Number(r.units),
    itemCount: Number(r.item_count),
  }));
}
