import { authStore, json, preflight } from "@/lib/auth-server";
import { validateShopify } from "@/lib/providers";
import { saveConnection } from "@/lib/data";
import { runFullSync } from "@/lib/shopify-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS() {
  return preflight();
}

/** Conecta a Shopify do workspace logado via token de app privado e sincroniza. */
export async function POST(req: Request) {
  const a = await authStore(req);
  if (a.res) return a.res;

  const body = await req.json().catch(() => ({}));
  const domain = String(body.domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  const token = String(body.token || "").trim();
  if (!domain || !token) return json({ ok: false, error: "Domínio e token são obrigatórios." }, 400);

  const v = await validateShopify(domain, token);
  if (!v.ok) {
    await saveConnection(a.storeId, "shopify", { domain }, null, "error", v.detail);
    return json({ ok: false, error: v.detail }, 400);
  }
  await saveConnection(a.storeId, "shopify", { domain }, token, "connected", v.detail);

  let products = 0, orders = 0;
  try {
    const r = await runFullSync(a.storeId);
    products = r.products;
    orders = r.orders;
  } catch {
    /* sincroniza depois pelo botão Atualizar */
  }
  return json({ ok: true, detail: v.detail, products, orders });
}
