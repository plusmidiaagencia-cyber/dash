import { authStore, json, preflight } from "@/lib/auth-server";
import { saveStoreGoal, saveCostSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

/** Salva meta de faturamento + custos (operacional, frete, taxa) do workspace logado. */
export async function POST(req: Request) {
  const a = await authStore(req);
  if (a.res) return a.res;

  const body = await req.json().catch(() => ({}));
  const mode = ["none", "flat", "percent"].includes(body.shippingMode) ? body.shippingMode : "none";
  await saveStoreGoal(a.storeId, Number(body.revenueGoal) || 0);
  await saveCostSettings(a.storeId, {
    monthlyOperational: Number(body.monthlyOperational) || 0,
    shippingMode: mode,
    shippingValue: Number(body.shippingValue) || 0,
    gatewayFeePercentFallback: Number(body.gatewayFeeFallback) || 0.029,
  });
  return json({ ok: true });
}
