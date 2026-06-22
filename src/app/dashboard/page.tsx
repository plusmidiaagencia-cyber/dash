import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Toolbar from "@/components/Toolbar";
import SyncButton from "@/components/SyncButton";
import Kpi from "@/components/Kpi";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { loadKpis } from "@/lib/metrics-db";
import { getConnections, getStore } from "@/lib/data";
import { resolveRange, type Period } from "@/lib/range";
import { getRate, type Currency, CURRENCIES } from "@/lib/fx";
import { money as fmtMoney, num, pct, mult, delta } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const STORE = DEFAULT_STORE_ID;

  const period: Period = (["today", "yesterday", "7d", "30d", "this_month", "last_month", "custom"].includes(sp.period || "") ? sp.period : "30d") as Period;
  const range = resolveRange(period, sp.from, sp.to);

  let cur: Currency = (CURRENCIES.includes((sp.cur || "GBP") as Currency) ? sp.cur : "GBP") as Currency;
  let fx = 1;
  if (cur !== "GBP") {
    const r = await getRate("GBP", cur);
    if (r) fx = r;
    else cur = "GBP";
  }
  const money = (v: number) => fmtMoney(v * fx, cur);

  const [curK, prev, conns, store] = await Promise.all([
    loadKpis(STORE, { from: range.from, to: range.to }),
    loadKpis(STORE, { from: range.prevFrom, to: range.prevTo }),
    getConnections(STORE),
    getStore(STORE),
  ]);

  const shConnected = conns.shopify?.status === "connected";
  const fbConnected = conns.facebook?.status === "connected";
  const nothingConnected = !shConnected && !fbConnected;
  const goal = store?.revenueGoal ?? 0;
  const goalPct = goal > 0 ? curK.revenue / goal : 0;
  const ringDeg = Math.round(Math.min(goalPct, 1) * 360);
  const maxRev = Math.max(...curK.daily.map((d) => d.revenue), 1);

  return (
    <div className="wrap">
      <Sidebar />
      <main className="main">
        {nothingConnected && (
          <div className="banner">
            Nenhuma fonte conectada — os números estão zerados.{" "}
            <Link href="/settings" style={{ textDecoration: "underline" }}>Conectar Shopify e Facebook →</Link>
          </div>
        )}

        <div className="top">
          <div className="store">
            <div className="av">H</div>
            <div><small>Bem-vindo de volta</small><b>{store?.name ?? "HARGROVE London"}</b></div>
          </div>
          <div className="filters">
            <span className={`delta ${shConnected ? "up" : "flat"}`}>{shConnected ? "● Shopify" : "○ Shopify"}</span>
            <span className={`delta ${fbConnected ? "up" : "flat"}`}>{fbConnected ? "● Facebook" : "○ Facebook"}</span>
            <Toolbar period={period} currency={cur} from={range.from} to={range.to} />
            <SyncButton />
            <Link className="pill btn" href="/settings">⚙ Conexões</Link>
          </div>
        </div>

        <p className="muted" style={{ margin: "-6px 0 14px" }}>
          {range.label} · {range.from} → {range.to}
        </p>

        {/* KPIs principais */}
        <div className="grid kpis">
          <Kpi highlight label="Lucro líquido" value={money(curK.profit)} icon="💷" iconBg="rgba(67,201,139,.2)" delta={delta(curK.profit, prev.profit)} />
          <Kpi label="Faturamento" value={money(curK.revenue)} icon="📈" iconBg="rgba(109,108,240,.18)" delta={delta(curK.revenue, prev.revenue)} />
          <Kpi label="Custos totais" value={money(curK.totalCosts)} icon="💸" iconBg="rgba(226,104,95,.16)" delta={delta(curK.totalCosts, prev.totalCosts)} goodWhenUp={false} />
          <Kpi label="Taxas (gateway)" value={money(curK.gatewayFees)} icon="🧾" iconBg="rgba(194,168,120,.18)" delta={delta(curK.gatewayFees, prev.gatewayFees)} goodWhenUp={false} />
          <Kpi label="Margem" value={pct(curK.margin)} icon="％" iconBg="rgba(194,168,120,.18)" delta={delta(curK.margin, prev.margin)} />
        </div>

        {/* funil + meta */}
        <div className="grid row2">
          <div className="card">
            <h3>Funil de conversão <span className="tag">Facebook Pixel</span></h3>
            <div className="funnel">
              {curK.funnel.map((s) => (
                <div className="step" key={s.key}>
                  <div className="nm">{s.label}</div>
                  <div className="pct">{pct(s.pctOfTop, 0)}</div>
                  <div className="sub">{num(s.count)}</div>
                </div>
              ))}
            </div>
            <div className="bars">
              {curK.funnel.map((s) => (<span key={s.key} style={{ height: `${Math.max(s.pctOfTop * 100, 3)}%` }} />))}
            </div>
          </div>
          <div className="card gauge">
            <h3 style={{ alignSelf: "flex-start" }}>Meta de faturamento</h3>
            <div className="ring" style={{ background: `conic-gradient(var(--champ) 0 ${ringDeg}deg, #2a2e36 ${ringDeg}deg 360deg)` }}>
              <div className="hole">
                <b>{pct(goalPct, 0)}</b>
                <small className="muted">{money(curK.revenue)} / {money(goal)}</small>
              </div>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              {goal > 0 ? `Faltam ${money(Math.max(goal - curK.revenue, 0))} para a meta` : "Meta não definida"}
            </div>
          </div>
        </div>

        {/* tráfego pago */}
        <div className="grid secondary">
          <Kpi label="Investido em ads" value={money(curK.adSpend)} icon="🎯" iconBg="rgba(24,119,242,.18)" delta={delta(curK.adSpend, prev.adSpend)} goodWhenUp={false} />
          <Kpi label="CPA" value={curK.cpa > 0 ? money(curK.cpa) : "—"} icon="🧮" iconBg="rgba(109,108,240,.18)" delta={delta(curK.cpa, prev.cpa)} goodWhenUp={false} />
          <Kpi label="ROI" value={mult(curK.roi)} icon="📊" iconBg="rgba(67,201,139,.16)" delta={delta(curK.roi, prev.roi)} />
          <Kpi label="ROAS" value={mult(curK.roas)} icon="🚀" iconBg="rgba(194,168,120,.18)" delta={delta(curK.roas, prev.roas)} />
        </div>
        <div className="grid secondary">
          <Kpi label="Custo de produto (CMV)" value={money(curK.cogs)} icon="📦" iconBg="rgba(139,143,152,.18)" delta={delta(curK.cogs, prev.cogs)} goodWhenUp={false} />
          <Kpi label="Pedidos" value={num(curK.orders)} icon="🛒" iconBg="rgba(109,108,240,.18)" delta={delta(curK.orders, prev.orders)} />
          <Kpi label="Ticket médio" value={curK.aov > 0 ? money(curK.aov) : "—"} icon="🎟️" iconBg="rgba(194,168,120,.18)" delta={delta(curK.aov, prev.aov)} />
          <Kpi label="Taxa de conversão" value={pct(curK.conversion)} icon="✅" iconBg="rgba(67,201,139,.16)" delta={delta(curK.conversion, prev.conversion)} />
        </div>

        {/* gasto por canal */}
        <div className="grid spend">
          <div className="card"><div className="sp"><div className="b" style={{ background: "var(--fb)" }}>f</div><div><small>Facebook Ads — gasto</small><b>{money(curK.adSpend)} {!fbConnected && <span className="tag">não conectado</span>}</b></div></div></div>
          <div className="card"><div className="sp"><div className="b" style={{ background: "#000" }}>▮</div><div><small>TikTok Ads — gasto</small><b>{money(0)} <span className="tag">em breve</span></b></div></div></div>
          <div className="card"><div className="sp"><div className="b" style={{ background: "var(--shop)" }}>S</div><div><small>Shopify — pedidos</small><b>{num(curK.orders)} {!shConnected && <span className="tag">não conectado</span>}</b></div></div></div>
          <div className="card"><div className="sp"><div className="b" style={{ background: "var(--champ)", color: "#1b1b1b" }}>£</div><div><small>Operacional + extras</small><b>{money(curK.operational + curK.extras)}</b></div></div></div>
        </div>

        {/* gráfico diário */}
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Faturamento × Lucro × Custos (por dia)</h3>
          {curK.daily.length === 0 ? (
            <div className="chart" style={{ alignItems: "center", justifyContent: "center" }}>
              <span className="muted">Sem dados no período — conecte uma fonte para ver o gráfico.</span>
            </div>
          ) : (
            <div className="chart">
              {curK.daily.map((d) => {
                const h = (v: number) => `${Math.max((v / maxRev) * 160, 0)}px`;
                return (
                  <div className="col" key={d.date} title={d.date}>
                    <em style={{ height: h(d.revenue), background: "#3a3a8c" }} />
                    <em style={{ height: h(Math.max(d.profit, 0)), background: "var(--green)" }} />
                    <em style={{ height: h(d.costs), background: "var(--red)" }} />
                  </div>
                );
              })}
            </div>
          )}
          <div className="legend">
            <span><span className="dot" style={{ background: "#3a3a8c" }} />Faturamento</span>
            <span><span className="dot" style={{ background: "var(--green)" }} />Lucro</span>
            <span><span className="dot" style={{ background: "var(--red)" }} />Custos</span>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 22, textAlign: "center" }}>
          {store?.name ?? "HARGROVE"} · {cur}{fx !== 1 ? ` (câmbio GBP→${cur} ${fx.toFixed(4)})` : ""} · {nothingConnected ? "nenhuma fonte conectada" : "fontes conectadas"}
        </p>
      </main>
    </div>
  );
}
