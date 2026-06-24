/** Auth do servidor: valida o JWT do Supabase e resolve a loja do usuário.
 *  URL + chave publishable são públicas (mesmas do front) — não são segredo. */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sql } from "@/db";

const SUPABASE_URL = "https://zwcokxivesfpvheonpqu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Q8DnWcqmDveAeFT8adKcPA_Hrr8Ennu";

const supa = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Lê o header Authorization: Bearer <jwt>, valida no Supabase e devolve o user.id (ou null). */
export async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

/** Resolve a store_id do usuário (1 loja por account neste MVP). */
export async function resolveStoreId(userId: string): Promise<string | null> {
  const s = sql();
  const [row] = await s<{ id: string }[]>`
    select s.id from stores s
    join profiles pr on pr.account_id = s.account_id
    where pr.id = ${userId}
    order by s.created_at asc
    limit 1`;
  return row?.id ?? null;
}

/** Autentica + resolve loja. Retorna { storeId } ou { res } com a resposta de erro pronta. */
export async function authStore(req: Request): Promise<{ storeId: string; res?: undefined } | { storeId?: undefined; res: NextResponse }> {
  const userId = await getUserId(req);
  if (!userId) return { res: json({ ok: false, error: "não autenticado" }, 401) };
  const storeId = await resolveStoreId(userId);
  if (!storeId) return { res: json({ ok: false, error: "workspace sem loja" }, 404) };
  return { storeId };
}
