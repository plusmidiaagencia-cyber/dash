import { authStore, json, preflight } from "@/lib/auth-server";
import { sql } from "@/db";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

/** Desconecta um provider (shopify|facebook) do workspace logado. */
export async function POST(req: Request) {
  const a = await authStore(req);
  if (a.res) return a.res;

  const body = await req.json().catch(() => ({}));
  const provider = body.provider === "facebook" ? "facebook" : "shopify";
  const s = sql();
  await s`update connections set status = 'disconnected' where store_id = ${a.storeId} and provider = ${provider}`;
  return json({ ok: true });
}
