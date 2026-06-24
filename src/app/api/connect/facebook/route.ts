import { authStore, json, preflight } from "@/lib/auth-server";
import { validateFacebook } from "@/lib/providers";
import { saveConnection } from "@/lib/data";
import { syncFacebook } from "@/lib/facebook-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS() {
  return preflight();
}

/** Conecta a conta de Facebook Ads do workspace logado e sincroniza gasto + funil. */
export async function POST(req: Request) {
  const a = await authStore(req);
  if (a.res) return a.res;

  const body = await req.json().catch(() => ({}));
  const raw = String(body.accountId || "").trim();
  const token = String(body.token || "").trim();
  const apiVersion = String(body.apiVersion || "v21.0").trim();
  const pixelId = String(body.pixelId || "").trim();
  if (!raw || !token) return json({ ok: false, error: "ID da conta e token são obrigatórios." }, 400);
  const accountId = raw.startsWith("act_") ? raw : `act_${raw}`;

  const v = await validateFacebook(token, accountId, apiVersion);
  if (!v.ok) {
    await saveConnection(a.storeId, "facebook", { accountId, apiVersion }, null, "error", v.detail);
    return json({ ok: false, error: v.detail }, 400);
  }
  const publicFields: Record<string, string> = { accountId, apiVersion };
  if (pixelId) publicFields.pixelId = pixelId;
  await saveConnection(a.storeId, "facebook", publicFields, token, "connected", v.detail);

  let fbDays = 0;
  try {
    fbDays = await syncFacebook(a.storeId);
  } catch {
    /* sincroniza depois pelo botão Atualizar */
  }
  return json({ ok: true, detail: v.detail, fbDays });
}
