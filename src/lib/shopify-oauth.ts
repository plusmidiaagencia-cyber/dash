/** Helpers do OAuth do Shopify (modelo "traga seu Client ID/Secret"). */

export const SHOPIFY_SCOPES = [
  "read_orders",
  "read_draft_orders",
  "read_products",
  "read_shopify_payments_payouts",
  "read_shopify_payments_disputes",
  "read_shopify_payments_accounts",
].join(",");

export function callbackUrl(): string {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/shopify/callback`;
}

export function authorizeUrl(domain: string, clientId: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    scope: SHOPIFY_SCOPES,
    redirect_uri: callbackUrl(),
    state,
  });
  return `https://${domain}/admin/oauth/authorize?${p.toString()}`;
}

export async function exchangeToken(
  domain: string, clientId: string, clientSecret: string, code: string
): Promise<string> {
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Troca de token falhou (${res.status})`);
  const j = await res.json();
  if (!j.access_token) throw new Error("Resposta sem access_token");
  return j.access_token as string;
}
