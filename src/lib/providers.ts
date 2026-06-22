/** Validação real das credenciais ao conectar (faz o "Conectar" ser de verdade). */

export type ValidationResult = { ok: boolean; detail: string };

/** Testa o Admin API token do Shopify chamando /shop.json. */
export async function validateShopify(domain: string, token: string): Promise<ValidationResult> {
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  try {
    const res = await fetch(`https://${clean}/admin/api/2024-10/shop.json`, {
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const j = await res.json();
      return { ok: true, detail: `Conectado: ${j.shop?.name ?? clean}` };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, detail: "Token inválido ou sem permissão." };
    return { ok: false, detail: `Erro ${res.status} ao validar.` };
  } catch (e) {
    return { ok: false, detail: `Falha de conexão: ${(e as Error).message}` };
  }
}

/** Testa o token do Facebook chamando o ad account. */
export async function validateFacebook(token: string, accountId: string, apiVersion = "v21.0"): Promise<ValidationResult> {
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  try {
    const url = `https://graph.facebook.com/${apiVersion}/${acct}?fields=name,currency,account_status&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: "no-store" });
    const j = await res.json();
    if (res.ok && j.id) return { ok: true, detail: `Conectado: ${j.name ?? acct} (${j.currency ?? "?"})` };
    return { ok: false, detail: j.error?.message ?? `Erro ${res.status}.` };
  } catch (e) {
    return { ok: false, detail: `Falha de conexão: ${(e as Error).message}` };
  }
}
