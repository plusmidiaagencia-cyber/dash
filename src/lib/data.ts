/** Camada de dados do servidor — leituras/escritas no Postgres. */
import { sql } from "@/db";
import { encrypt } from "./crypto";
import type { CostSettings } from "./metrics";

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
