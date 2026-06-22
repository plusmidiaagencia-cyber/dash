/**
 * Motor de métricas — funções puras (sem I/O).
 * Recebe eventos crus (pedidos, gasto diário) + configurações de custo
 * e devolve os KPIs do painel, conforme spec §6.
 *
 * Estas funções são a parte testável e crítica do sistema: o cálculo do
 * lucro real. Servem tanto para os dados de exemplo quanto, depois, para os
 * dados reais vindos de Shopify/Facebook.
 */

export type RawOrderItem = {
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

export type RawOrder = {
  id: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  financialStatus: "paid" | "refunded" | "cancelled";
  total: number;
  refundedAmount: number;
  transactionFee: number;
  items: RawOrderItem[];
};

export type DaySpend = {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  spend: number;
  pageViews: number;
  viewContent: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
};

export type CostSettings = {
  monthlyOperational: number;
  shippingMode: "none" | "flat" | "percent";
  shippingValue: number;
  gatewayFeePercentFallback: number;
  revenueGoal: number;
};

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  pctOfTop: number;
};

export type DailyPoint = {
  date: string;
  revenue: number;
  profit: number;
  costs: number;
};

export type Kpis = {
  revenue: number;
  cogs: number;
  adSpend: number;
  gatewayFees: number;
  shipping: number;
  operational: number;
  extras: number;
  totalCosts: number;
  profit: number;
  margin: number;
  roas: number;
  roi: number;
  cpa: number;
  aov: number;
  orders: number;
  units: number;
  conversion: number;
  funnel: FunnelStep[];
  goalPct: number;
  daily: DailyPoint[];
};

const isCounted = (o: RawOrder) => o.financialStatus !== "cancelled";

/** Nº de dias inteiros no intervalo [from, to]. */
function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function daysInMonthOf(dateIso: string): number {
  const d = new Date(dateIso + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

export function computeKpis(
  orders: RawOrder[],
  spend: DaySpend[],
  settings: CostSettings,
  range: { from: string; to: string }
): Kpis {
  const counted = orders.filter(isCounted);

  const grossRevenue = counted.reduce((s, o) => s + o.total, 0);
  const refunds = counted.reduce((s, o) => s + o.refundedAmount, 0);
  const revenue = grossRevenue - refunds;

  const cogs = counted.reduce(
    (s, o) => s + o.items.reduce((si, it) => si + it.unitCost * it.quantity, 0),
    0
  );

  const adSpend = spend.reduce((s, d) => s + d.spend, 0);

  const realFees = counted.reduce((s, o) => s + o.transactionFee, 0);
  const gatewayFees =
    realFees > 0 ? realFees : revenue * settings.gatewayFeePercentFallback;

  const orderCount = counted.length;
  let shipping = 0;
  if (settings.shippingMode === "flat") shipping = settings.shippingValue * orderCount;
  else if (settings.shippingMode === "percent") shipping = revenue * settings.shippingValue;

  const periodDays = daysBetween(range.from, range.to);
  const dim = daysInMonthOf(range.from);
  const operational = (settings.monthlyOperational / dim) * periodDays;

  const extras = refunds; // ajustes manuais entram aqui na versão com dados reais

  const totalCosts = cogs + adSpend + gatewayFees + shipping + operational + extras;
  const profit = revenue - totalCosts;

  const margin = revenue > 0 ? profit / revenue : 0;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const roi = adSpend > 0 ? profit / adSpend : 0;
  const cpa = orderCount > 0 ? adSpend / orderCount : 0;
  const aov = orderCount > 0 ? revenue / orderCount : 0;
  const units = counted.reduce(
    (s, o) => s + o.items.reduce((si, it) => si + it.quantity, 0),
    0
  );

  const f = spend.reduce(
    (acc, d) => {
      acc.pageViews += d.pageViews;
      acc.viewContent += d.viewContent;
      acc.addToCart += d.addToCart;
      acc.initiateCheckout += d.initiateCheckout;
      acc.purchases += d.purchases;
      return acc;
    },
    { pageViews: 0, viewContent: 0, addToCart: 0, initiateCheckout: 0, purchases: 0 }
  );
  const top = f.pageViews || 1;
  const funnel: FunnelStep[] = [
    { key: "pageViews", label: "PageView", count: f.pageViews, pctOfTop: 1 },
    { key: "viewContent", label: "ViewContent", count: f.viewContent, pctOfTop: f.viewContent / top },
    { key: "addToCart", label: "AddToCart", count: f.addToCart, pctOfTop: f.addToCart / top },
    { key: "initiateCheckout", label: "InitiateCheckout", count: f.initiateCheckout, pctOfTop: f.initiateCheckout / top },
    { key: "purchases", label: "Purchase", count: f.purchases, pctOfTop: f.purchases / top },
  ];
  const conversion = f.pageViews > 0 ? f.purchases / f.pageViews : 0;
  const goalPct = settings.revenueGoal > 0 ? revenue / settings.revenueGoal : 0;

  // série diária (Faturamento / Lucro / Custos) para o gráfico
  const byDay = new Map<string, DailyPoint>();
  const ensure = (date: string) => {
    let p = byDay.get(date);
    if (!p) {
      p = { date, revenue: 0, profit: 0, costs: 0 };
      byDay.set(date, p);
    }
    return p;
  };
  for (const o of counted) {
    const p = ensure(o.date);
    const oRevenue = o.total - o.refundedAmount;
    const oCogs = o.items.reduce((si, it) => si + it.unitCost * it.quantity, 0);
    p.revenue += oRevenue;
    p.costs += oCogs + o.transactionFee + o.refundedAmount;
  }
  for (const d of spend) {
    const p = ensure(d.date);
    p.costs += d.spend;
  }
  const opPerDay = settings.monthlyOperational / dim;
  for (const p of byDay.values()) {
    p.costs += opPerDay;
    p.profit = p.revenue - p.costs;
  }
  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    revenue, cogs, adSpend, gatewayFees, shipping, operational, extras,
    totalCosts, profit, margin, roas, roi, cpa, aov, orders: orderCount,
    units, conversion, funnel, goalPct, daily,
  };
}
