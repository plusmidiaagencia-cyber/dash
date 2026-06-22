/**
 * Motor de métricas — funções puras (sem I/O).
 * Recebe eventos crus (pedidos, gasto diário, ajustes) + configurações de custo
 * e devolve os KPIs do painel.
 *
 * Convenções (definição de lucro):
 *   Faturamento = Σ total dos pedidos − Σ reembolsos        (vendas líquidas de devolução)
 *   Custos      = CMV + Ads + Taxas(gateway) + Frete + Operacional + Impostos + Ajustes
 *   Lucro       = Faturamento − Custos
 * Imposto entra como CUSTO (não infla o lucro). Reembolso reduz o faturamento
 * UMA vez (não é contado de novo como custo). Tudo em GBP (moeda base).
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
  financialStatus: "paid" | "refunded" | "cancelled" | string;
  total: number;
  refundedAmount: number;
  transactionFee: number;
  /** imposto do pedido (entra como custo) */
  tax?: number;
  items: RawOrderItem[];
};

export type DaySpend = {
  date: string;
  spend: number;
  pageViews: number;
  viewContent: number;
  addToCart: number;
  initiateCheckout: number;
  purchases: number;
};

export type Adjustment = { date: string; amount: number };

export type CostSettings = {
  monthlyOperational: number;
  shippingMode: "none" | "flat" | "percent";
  shippingValue: number;
  gatewayFeePercentFallback: number;
  revenueGoal: number;
};

export type FunnelStep = { key: string; label: string; count: number; pctOfTop: number };
export type DailyPoint = { date: string; revenue: number; profit: number; costs: number };

export type Kpis = {
  revenue: number;
  cogs: number;
  adSpend: number;
  gatewayFees: number;
  shipping: number;
  operational: number;
  tax: number;
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

function daysInMonth(dateIso: string): number {
  const d = new Date(dateIso + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Lista de datas ISO (inclusive) entre from e to. */
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  if (b < a) return [from];
  for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function computeKpis(
  orders: RawOrder[],
  spend: DaySpend[],
  settings: CostSettings,
  range: { from: string; to: string },
  adjustments: Adjustment[] = []
): Kpis {
  const counted = orders.filter(isCounted);
  const fallback = settings.gatewayFeePercentFallback;

  // série diária: começa com TODOS os dias do período (garante Σ diário = agregado)
  const days = eachDay(range.from, range.to);
  const byDay = new Map<string, DailyPoint>();
  for (const d of days) byDay.set(d, { date: d, revenue: 0, profit: 0, costs: 0 });
  const dayOf = (date: string) => byDay.get(date); // pode ser undefined se fora do range

  // operacional: rateio por dia conforme o mês de cada dia
  let operational = 0;
  for (const d of days) {
    const op = settings.monthlyOperational / daysInMonth(d);
    operational += op;
    const p = dayOf(d);
    if (p) p.costs += op;
  }

  // passada única nos pedidos
  let revenue = 0, cogs = 0, gatewayFees = 0, shipping = 0, tax = 0, units = 0;
  for (const o of counted) {
    const oRevenue = o.total - o.refundedAmount;
    const oCogs = o.items.reduce((s, it) => s + it.unitCost * it.quantity, 0);
    const oFee = o.transactionFee > 0 ? o.transactionFee : oRevenue * fallback;
    const oShip =
      settings.shippingMode === "flat" ? settings.shippingValue
      : settings.shippingMode === "percent" ? oRevenue * settings.shippingValue
      : 0;
    const oTax = o.tax || 0;

    revenue += oRevenue;
    cogs += oCogs;
    gatewayFees += oFee;
    shipping += oShip;
    tax += oTax;
    units += o.items.reduce((s, it) => s + it.quantity, 0);

    const p = dayOf(o.date);
    if (p) {
      p.revenue += oRevenue;
      p.costs += oCogs + oFee + oShip + oTax;
    }
  }

  // gasto de ads (por dia)
  let adSpend = 0;
  for (const d of spend) {
    adSpend += d.spend;
    const p = dayOf(d.date);
    if (p) p.costs += d.spend;
  }

  // ajustes manuais (por dia)
  let extras = 0;
  for (const a of adjustments) {
    extras += a.amount;
    const p = dayOf(a.date);
    if (p) p.costs += a.amount;
  }

  const totalCosts = cogs + adSpend + gatewayFees + shipping + operational + tax + extras;
  const profit = revenue - totalCosts;

  const orderCount = counted.length;
  const margin = revenue > 0 ? profit / revenue : 0;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const roi = adSpend > 0 ? profit / adSpend : 0;
  const cpa = orderCount > 0 ? adSpend / orderCount : 0;
  const aov = orderCount > 0 ? revenue / orderCount : 0;

  // funil (Facebook)
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
    { key: "pageViews", label: "PageView", count: f.pageViews, pctOfTop: f.pageViews > 0 ? 1 : 0 },
    { key: "viewContent", label: "ViewContent", count: f.viewContent, pctOfTop: f.viewContent / top },
    { key: "addToCart", label: "AddToCart", count: f.addToCart, pctOfTop: f.addToCart / top },
    { key: "initiateCheckout", label: "InitiateCheckout", count: f.initiateCheckout, pctOfTop: f.initiateCheckout / top },
    { key: "purchases", label: "Purchase", count: f.purchases, pctOfTop: f.purchases / top },
  ];
  const conversion = f.pageViews > 0 ? f.purchases / f.pageViews : 0;
  const goalPct = settings.revenueGoal > 0 ? revenue / settings.revenueGoal : 0;

  for (const p of byDay.values()) p.profit = p.revenue - p.costs;
  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    revenue, cogs, adSpend, gatewayFees, shipping, operational, tax, extras,
    totalCosts, profit, margin, roas, roi, cpa, aov, orders: orderCount,
    units, conversion, funnel, goalPct, daily,
  };
}
