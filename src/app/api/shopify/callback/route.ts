import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { getShopifyOAuth, saveShopifyToken, saveConnection } from "@/lib/data";
import { exchangeToken } from "@/lib/shopify-oauth";
import { runFullSync } from "@/lib/shopify-sync";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const shop = url.searchParams.get("shop") || "";
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const base = process.env.APP_URL || url.origin;

  const oauth = await getShopifyOAuth(DEFAULT_STORE_ID);
  if (!oauth) return NextResponse.redirect(`${base}/settings?error=shopify_nao_iniciado`);
  if (!code || !shop) return NextResponse.redirect(`${base}/settings?error=callback_invalido`);
  if (state !== oauth.state) return NextResponse.redirect(`${base}/settings?error=state_invalido`);

  try {
    const token = await exchangeToken(oauth.domain, oauth.clientId, oauth.clientSecret, code);
    await saveShopifyToken(DEFAULT_STORE_ID, token, `Conectado: ${oauth.domain}`);
    try {
      await runFullSync(DEFAULT_STORE_ID);
    } catch {
      // sincroniza depois via botão "Sincronizar" se falhar aqui
    }
    return NextResponse.redirect(`${base}/dashboard?connected=shopify`);
  } catch (e) {
    await saveConnection(DEFAULT_STORE_ID, "shopify", { domain: oauth.domain }, null, "error", (e as Error).message);
    return NextResponse.redirect(`${base}/settings?error=token`);
  }
}
