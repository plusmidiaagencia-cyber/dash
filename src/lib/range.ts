/** Resolve o período selecionado em intervalos de datas (atual + anterior p/ deltas). */

export type Period = "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "custom";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  this_month: "Este mês",
  last_month: "Mês passado",
  custom: "Personalizado",
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function daysInclusive(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000) + 1;
}

export type ResolvedRange = {
  period: Period;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
};

export function resolveRange(period: Period, customFrom?: string, customTo?: string): ResolvedRange {
  const now = new Date();
  const today = iso(now);
  let from = today;
  let to = today;

  switch (period) {
    case "today":
      from = to = today;
      break;
    case "yesterday":
      from = to = addDays(today, -1);
      break;
    case "7d":
      to = today;
      from = addDays(today, -6);
      break;
    case "30d":
      to = today;
      from = addDays(today, -29);
      break;
    case "this_month": {
      from = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
      to = today;
      break;
    }
    case "last_month": {
      from = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
      to = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
      break;
    }
    case "custom": {
      from = customFrom || today;
      to = customTo || today;
      if (from > to) [from, to] = [to, from];
      break;
    }
  }

  const len = daysInclusive(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));

  return { period, from, to, prevFrom, prevTo, label: PERIOD_LABELS[period] };
}
