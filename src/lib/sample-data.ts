/**
 * Dados de EXEMPLO (fictícios) para o painel renderizar antes das integrações
 * reais estarem conectadas. Quando USE_SAMPLE_DATA for desligado e
 * Shopify/Facebook estiverem ligados, esta camada é substituída pelos dados
 * crus do banco — o motor de métricas (lib/metrics) é o mesmo.
 *
 * Geração determinística (sem Math.random) para o build/preview ser estável.
 */
import type { RawOrder, DaySpend, CostSettings } from "./metrics";

// PRNG determinístico (mulberry32)
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PRODUCTS = [
  { title: "The Mayfair", price: 119, cost: 34 },
  { title: "The Kensington", price: 139, cost: 41 },
  { title: "The Hartwell", price: 99, cost: 28 },
  { title: "The Camden", price: 109, cost: 31 },
  { title: "The Sloane", price: 89, cost: 24 },
];

/** Gera N dias de pedidos + gasto, terminando em `endDate`. */
function generate(endDate: Date, days: number, seed: number, ordersPerDayAvg: number) {
  const rand = rng(seed);
  const orders: RawOrder[] = [];
  const spend: DaySpend[] = [];
  let orderId = seed * 100000;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setUTCDate(d.getUTCDate() - i);
    const date = iso(d);

    // pedidos do dia
    const dayOrders = Math.max(1, Math.round(ordersPerDayAvg + (rand() - 0.5) * ordersPerDayAvg));
    let dayPurchases = 0;
    for (let j = 0; j < dayOrders; j++) {
      const lines = 1 + (rand() < 0.25 ? 1 : 0);
      const items = [];
      let total = 0;
      for (let k = 0; k < lines; k++) {
        const p = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
        const qty = 1 + (rand() < 0.15 ? 1 : 0);
        items.push({ quantity: qty, unitPrice: p.price, unitCost: p.cost });
        total += p.price * qty;
      }
      const refunded = rand() < 0.04 ? total : 0;
      orders.push({
        id: String(orderId++),
        date,
        financialStatus: refunded ? "refunded" : "paid",
        total,
        refundedAmount: refunded,
        transactionFee: Math.round(total * 0.029 * 100) / 100 + 0.25,
        items,
      });
      if (!refunded) dayPurchases++;
    }

    // gasto + funil do dia (Facebook)
    const daySpend = Math.round((30 + rand() * 25) * 100) / 100;
    const pageViews = Math.round(150 + rand() * 90);
    const viewContent = Math.round(pageViews * (0.55 + rand() * 0.1));
    const addToCart = Math.round(viewContent * (0.35 + rand() * 0.1));
    const initiateCheckout = Math.round(addToCart * (0.6 + rand() * 0.1));
    spend.push({
      date,
      spend: daySpend,
      pageViews,
      viewContent,
      addToCart,
      initiateCheckout,
      purchases: dayPurchases,
    });
  }
  return { orders, spend };
}

export const SAMPLE_SETTINGS: CostSettings = {
  monthlyOperational: 180,
  shippingMode: "none",
  shippingValue: 0,
  gatewayFeePercentFallback: 0.029,
  revenueGoal: 10000,
};

export type SampleBundle = {
  current: { orders: RawOrder[]; spend: DaySpend[] };
  previous: { orders: RawOrder[]; spend: DaySpend[] };
  range: { from: string; to: string };
  settings: CostSettings;
};

/** Conjunto: período atual (30 dias até hoje) + período anterior (30 dias antes). */
export function getSampleBundle(): SampleBundle {
  const today = new Date();
  const endCurrent = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endPrevious = new Date(endCurrent);
  endPrevious.setUTCDate(endPrevious.getUTCDate() - 30);

  const current = generate(endCurrent, 30, 7, 4);
  const previous = generate(endPrevious, 30, 13, 3.4);

  const from = new Date(endCurrent);
  from.setUTCDate(from.getUTCDate() - 29);

  return {
    current,
    previous,
    range: { from: iso(from), to: iso(endCurrent) },
    settings: SAMPLE_SETTINGS,
  };
}
