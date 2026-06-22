/** Câmbio para a troca de moeda (base GBP). Usa frankfurter.app (grátis, sem chave). */

export const CURRENCIES = ["GBP", "USD", "EUR", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Retorna a taxa base->target, ou null se falhar (aí o app mantém a base). */
export async function getRate(base: Currency, target: Currency): Promise<number | null> {
  if (target === base) return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${target}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j?.rates?.[target];
    return typeof r === "number" ? r : null;
  } catch {
    return null;
  }
}
