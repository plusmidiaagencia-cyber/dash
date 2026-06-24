import { NextResponse } from "next/server";
import { runAllSync } from "@/app/actions/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Dispara o sync completo (Shopify + Facebook, com conversão de moeda) e devolve o resumo.
 *  Chamado pelo front (botão "Atualizar" / ao entrar na tela). Idempotente (upserts). */
export async function POST() {
  try {
    const r = await runAllSync();
    return NextResponse.json(r, { headers: CORS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500, headers: CORS });
  }
}
