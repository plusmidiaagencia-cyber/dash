import { authStore, json, preflight } from "@/lib/auth-server";
import { runAllSync } from "@/app/actions/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS() {
  return preflight();
}

/** Dispara o sync completo (Shopify + Facebook) da loja do workspace logado.
 *  Chamado pelo front (botão "Atualizar" / ao entrar na tela). Idempotente (upserts). */
export async function POST(req: Request) {
  const a = await authStore(req);
  if (a.res) return a.res;
  try {
    const r = await runAllSync(a.storeId);
    return json(r);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
