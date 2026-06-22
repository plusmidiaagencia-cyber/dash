/** Formatação de valores para a UI (GBP por padrão na Fase 1). */

export function gbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function num(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(value || 0));
}

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Multiplicador puro (ROAS/ROI) — mostra "—" quando indefinido. */
export function mult(value: number): string {
  if (!isFinite(value) || value === 0) return "—";
  return value.toFixed(2);
}

/** Variação percentual entre período atual e anterior. */
export function delta(current: number, previous: number): number {
  if (!previous) return 0;
  return (current - previous) / previous;
}

export function deltaLabel(d: number): string {
  const sign = d > 0 ? "+" : "";
  return `${sign}${(d * 100).toFixed(0)}%`;
}
