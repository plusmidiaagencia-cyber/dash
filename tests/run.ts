/**
 * Testes da matemática do painel (sem framework — node:assert via tsx).
 * Rodar: npm test
 * Cada valor esperado foi calculado à mão e documentado.
 */
import assert from "node:assert";
import { computeKpis, type RawOrder, type DaySpend, type CostSettings } from "../src/lib/metrics";
import { resolveRange } from "../src/lib/range";
import { gbp, money, delta } from "../src/lib/format";

let passed = 0;
const fails: string[] = [];
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓", name); }
  catch (e) { fails.push(`${name}: ${(e as Error).message}`); console.log("  ✗", name, "—", (e as Error).message); }
}
const approx = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `esperado ${b}, veio ${a}`);

// ---------- Cenário principal ----------
const settings: CostSettings = {
  monthlyOperational: 300, shippingMode: "flat", shippingValue: 2,
  gatewayFeePercentFallback: 0.029, revenueGoal: 1000,
};
const range = { from: "2026-06-01", to: "2026-06-30" };
const orders: RawOrder[] = [
  { id: "1", date: "2026-06-05", financialStatus: "paid", total: 100, refundedAmount: 0, transactionFee: 3, tax: 10,
    items: [{ quantity: 2, unitPrice: 50, unitCost: 20 }] }, // cogs 40, fee 3, ship 2, tax 10
  { id: "2", date: "2026-06-10", financialStatus: "paid", total: 50, refundedAmount: 10, transactionFee: 0, tax: 5,
    items: [{ quantity: 1, unitPrice: 50, unitCost: 18 }] }, // oRev 40, cogs 18, fee 40*.029=1.16, ship 2, tax 5
  { id: "3", date: "2026-06-15", financialStatus: "cancelled", total: 999, refundedAmount: 0, transactionFee: 0, tax: 0, items: [] },
];
const spend: DaySpend[] = [
  { date: "2026-06-05", spend: 20, pageViews: 100, viewContent: 40, addToCart: 20, initiateCheckout: 10, purchases: 2 },
  { date: "2026-06-10", spend: 30, pageViews: 50, viewContent: 25, addToCart: 10, initiateCheckout: 5, purchases: 1 },
];
const adjustments = [{ date: "2026-06-20", amount: 15 }, { date: "2026-06-22", amount: -5 }];
const k = computeKpis(orders, spend, settings, range, adjustments);

console.log("Cenário principal:");
check("faturamento (gross − refund) = 140", () => approx(k.revenue, 140));
check("CMV = 58", () => approx(k.cogs, 58));
check("gateway (3 + 40*0.029) = 4.16", () => approx(k.gatewayFees, 4.16));
check("frete (flat 2 × 2 pedidos) = 4", () => approx(k.shipping, 4));
check("imposto = 15", () => approx(k.tax, 15));
check("ads = 50", () => approx(k.adSpend, 50));
check("operacional (mês cheio) = 300", () => approx(k.operational, 300));
check("extras (ajustes 15 − 5) = 10", () => approx(k.extras, 10));
check("custos totais = 441.16", () => approx(k.totalCosts, 441.16));
check("lucro = 140 − 441.16 = −301.16", () => approx(k.profit, -301.16));
check("reembolso NÃO é contado 2x", () => {
  // se fosse, o lucro cairia mais 10 (o refund). Garantimos que extras não inclui refund.
  approx(k.profit, -301.16);
});
check("margem = lucro/fat", () => approx(k.margin, -301.16 / 140));
check("ROAS = 140/50 = 2.8", () => approx(k.roas, 2.8));
check("ROI = -301.16/50", () => approx(k.roi, -301.16 / 50));
check("CPA = 50/2 = 25", () => approx(k.cpa, 25));
check("ticket = 140/2 = 70", () => approx(k.aov, 70));
check("unidades = 3", () => approx(k.units, 3));
check("pedidos = 2 (cancelado excluído)", () => approx(k.orders, 2));
check("conversão = 3/150 = 0.02", () => approx(k.conversion, 0.02));
check("meta = 140/1000 = 0.14", () => approx(k.goalPct, 0.14));
check("funil PageView count = 150", () => approx(k.funnel[0].count, 150));
check("funil Purchase pctOfTop = 3/150", () => approx(k.funnel[4].pctOfTop, 3 / 150));

console.log("Reconciliação gráfico × headline:");
check("série diária tem 30 dias", () => approx(k.daily.length, 30));
check("Σ receita diária = faturamento", () => approx(k.daily.reduce((s, d) => s + d.revenue, 0), k.revenue));
check("Σ lucro diário = lucro do topo", () => approx(k.daily.reduce((s, d) => s + d.profit, 0), k.profit));
check("Σ custos diário = custos totais", () => approx(k.daily.reduce((s, d) => s + d.costs, 0), k.totalCosts));

console.log("Casos de borda:");
const zero = computeKpis([], [], { monthlyOperational: 0, shippingMode: "none", shippingValue: 0, gatewayFeePercentFallback: 0.029, revenueGoal: 0 }, range);
check("vazio → tudo 0, sem NaN", () => {
  for (const v of [zero.revenue, zero.profit, zero.margin, zero.roas, zero.roi, zero.cpa, zero.aov, zero.conversion, zero.goalPct, zero.totalCosts])
    assert.ok(Number.isFinite(v) && v === 0, `valor inesperado ${v}`);
});
check("vazio → funil PageView pctOfTop = 0 (não 100%)", () => approx(zero.funnel[0].pctOfTop, 0));

const cross = computeKpis([], [], { monthlyOperational: 310, shippingMode: "none", shippingValue: 0, gatewayFeePercentFallback: 0, revenueGoal: 0 }, { from: "2026-05-20", to: "2026-06-10" });
// maio 20–31 = 12 dias × 310/31 ; junho 1–10 = 10 dias × 310/30
const expectedOp = 12 * (310 / 31) + 10 * (310 / 30);
check("operacional rateado por mês (cruza maio/junho)", () => approx(cross.operational, expectedOp));
check("operacional cruzando meses = Σ diário", () => approx(cross.daily.reduce((s, d) => s + d.costs, 0), cross.operational));

console.log("Períodos (deltas):");
const r30 = resolveRange("30d");
check("30d: período atual tem 30 dias", () => {
  const days = (new Date(r30.to + "T00:00:00Z").getTime() - new Date(r30.from + "T00:00:00Z").getTime()) / 86400000 + 1;
  approx(days, 30);
});
check("30d: período anterior é adjacente e sem overlap", () => {
  assert.ok(r30.prevTo < r30.from, "prevTo deve ser antes de from");
  const prevDays = (new Date(r30.prevTo + "T00:00:00Z").getTime() - new Date(r30.prevFrom + "T00:00:00Z").getTime()) / 86400000 + 1;
  approx(prevDays, 30);
  // adjacência: from = prevTo + 1 dia
  const nextOfPrev = new Date(r30.prevTo + "T00:00:00Z"); nextOfPrev.setUTCDate(nextOfPrev.getUTCDate() + 1);
  assert.equal(nextOfPrev.toISOString().slice(0, 10), r30.from);
});
const rc = resolveRange("custom", "2026-06-01", "2026-06-10");
check("custom: from/to corretos", () => { assert.equal(rc.from, "2026-06-01"); assert.equal(rc.to, "2026-06-10"); });
check("custom: prev = 10 dias anteriores", () => { assert.equal(rc.prevTo, "2026-05-31"); assert.equal(rc.prevFrom, "2026-05-22"); });

console.log("Formatação:");
check("gbp formata em £", () => assert.ok(gbp(1234.5).includes("1,234.50") && gbp(1).includes("£")));
check("money BRL", () => assert.ok(money(10, "BRL").includes("10,00")));
check("delta 110 vs 100 = 0.1", () => approx(delta(110, 100), 0.1));
check("delta com anterior 0 = 0", () => approx(delta(5, 0), 0));

console.log(`\n${passed} passaram, ${fails.length} falharam.`);
if (fails.length) { console.error("FALHAS:\n" + fails.map((f) => " - " + f).join("\n")); process.exit(1); }
console.log("✅ matemática verificada.");
