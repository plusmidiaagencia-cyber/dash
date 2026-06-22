import Sidebar from "@/components/Sidebar";
import Kpi from "@/components/Kpi";
import { computeKpis } from "@/lib/metrics";
import { getSampleBundle } from "@/lib/sample-data";
import { gbp, num, pct, mult, delta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const usingSample = process.env.USE_SAMPLE_DATA !== "false";
  const bundle = getSampleBundle();
  const cur = computeKpis(bundle.current.orders, bundle.current.spend, bundle.settings, bundle.range);
  const prev = computeKpis(bundle.previous.orders, bundle.previous.spend, bundle.settings, bundle.range);

  const maxRev = Math.max(...cur.daily.map((d) => d.revenue), 1);
  const goalPct = Math.min(cur.goalPct, 1);
  const ringDeg = Math.round(goalPct * 360);

  return (
    <div className="wrap">
      <Sidebar />
      <main className="main">
        {usingSample && (
          <div className="banner">
            ⓘ Pré-visualização com <b>dados de exemplo</b>. Conecte Shopify e Facebook em Configurações para ver os números reais.
          </div>
        )}

        <div className="top">
          <div className="store">
            <div className="av">H</div>
            <div>
              <small>Bem-vindo de volta</small>
              <b>HARGROVE London</b>
            </div>
          </div>
          <div className="filters">
            <div className="pill btn">🔄 Atualizar agora</div>
            <div className="pill">📅 Últimos 30 dias ▾</div>
            <div className="pill">🇬🇧 GBP</div>
            <div className="pill dim">Atualizado há instantes</div>
          </div>
        </div>

        {/* KPIs principais */}
        <div className="grid kpis">
          <Kpi highlight label="Lucro líquido" value={gbp(cur.profit)} icon="💷" iconBg="rgba(67,201,139,.2)" delta={delta(cur.profit, prev.profit)} />
          <Kpi label="Faturamento" value={gbp(cur.revenue)} icon="📈" iconBg="rgba(109,108,240,.18)" delta={delta(cur.revenue, prev.revenue)} />
          <Kpi label="Custos totais" value={gbp(cur.totalCosts)} icon="💸" iconBg="rgba(226,104,95,.16)" delta={delta(cur.totalCosts, prev.totalCosts)} goodWhenUp={false} />
          <Kpi label="Taxas (gateway)" value={gbp(cur.gatewayFees)} icon="🧾" iconBg="rgba(194,168,120,.18)" delta={delta(cur.gatewayFees, prev.gatewayFees)} goodWhenUp={false} />
          <Kpi label="Margem" value={pct(cur.margin)} icon="％" iconBg="rgba(194,168,120,.18)" delta={delta(cur.margin, prev.margin)} />
        </div>

        {/* funil + meta */}
        <div className="grid row2">
          <div className="card">
            <h3>Funil de conversão <span className="tag">Facebook Pixel</span></h3>
            <div className="funnel">
              {cur.funnel.map((s) => (
                <div className="step" key={s.key}>
                  <div className="nm">{s.label}</div>
                  <div className="pct">{pct(s.pctOfTop, 0)}</div>
                  <div className="sub">{num(s.count)}</div>
                </div>
              ))}
            </div>
            <div className="bars">
              {cur.funnel.map((s) => (
                <span key={s.key} style={{ height: `${Math.max(s.pctOfTop * 100, 4)}%` }} />
              ))}
            </div>
          </div>
          <div className="card gauge">
            <h3 style={{ alignSelf: "flex-start" }}>Meta de faturamento</h3>
            <div
              className="ring"
              style={{ background: `conic-gradient(var(--champ) 0 ${ringDeg}deg, #2a2e36 ${ringDeg}deg 360deg)` }}
            >
              <div className="hole">
                <b>{pct(cur.goalPct, 0)}</b>
                <small className="muted">{gbp(cur.revenue)} / {gbp(bundle.settings.revenueGoal)}</small>
              </div>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              Faltam {gbp(Math.max(bundle.settings.revenueGoal - cur.revenue, 0))} para a meta
            </div>
          </div>
        </div>

        {/* tráfego pago */}
        <div className="grid secondary">
          <Kpi label="Investido em ads" value={gbp(cur.adSpend)} icon="🎯" iconBg="rgba(24,119,242,.18)" delta={delta(cur.adSpend, prev.adSpend)} goodWhenUp={false} />
          <Kpi label="CPA" value={gbp(cur.cpa)} icon="🧮" iconBg="rgba(109,108,240,.18)" delta={delta(cur.cpa, prev.cpa)} goodWhenUp={false} />
          <Kpi label="ROI" value={mult(cur.roi)} icon="📊" iconBg="rgba(67,201,139,.16)" delta={delta(cur.roi, prev.roi)} />
          <Kpi label="ROAS" value={mult(cur.roas)} icon="🚀" iconBg="rgba(194,168,120,.18)" delta={delta(cur.roas, prev.roas)} />
        </div>
        <div className="grid secondary">
          <Kpi label="Custo de produto (CMV)" value={gbp(cur.cogs)} icon="📦" iconBg="rgba(139,143,152,.18)" delta={delta(cur.cogs, prev.cogs)} goodWhenUp={false} />
          <Kpi label="Pedidos" value={num(cur.orders)} icon="🛒" iconBg="rgba(109,108,240,.18)" delta={delta(cur.orders, prev.orders)} />
          <Kpi label="Ticket médio" value={gbp(cur.aov)} icon="🎟️" iconBg="rgba(194,168,120,.18)" delta={delta(cur.aov, prev.aov)} />
          <Kpi label="Taxa de conversão" value={pct(cur.conversion)} icon="✅" iconBg="rgba(67,201,139,.16)" delta={delta(cur.conversion, prev.conversion)} />
        </div>

        {/* gasto por canal */}
        <div className="grid spend">
          <div className="card"><div className="sp"><div className="b" style={{ background: "var(--fb)" }}>f</div><div><small>Facebook Ads — gasto</small><b>{gbp(cur.adSpend)}</b></div></div></div>
          <div className="card"><div className="sp"><div className="b" style={{ background: "#000" }}>▮</div><div><small>TikTok Ads — gasto</small><b>{gbp(0)} <span className="tag">não conectado</span></b></div></div></div>
          <div className="card"><div className="sp"><div className="b" style={{ background: "var(--shop)" }}>S</div><div><small>Shopify — pedidos</small><b>{num(cur.orders)}</b></div></div></div>
          <div className="card"><div className="sp"><div className="b" style={{ background: "var(--champ)", color: "#1b1b1b" }}>£</div><div><small>Operacional + extras</small><b>{gbp(cur.operational + cur.extras)}</b></div></div></div>
        </div>

        {/* gráfico diário */}
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Faturamento × Lucro × Custos (por dia)</h3>
          <div className="chart">
            {cur.daily.map((d) => {
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
          <div className="legend">
            <span><span className="dot" style={{ background: "#3a3a8c" }} />Faturamento</span>
            <span><span className="dot" style={{ background: "var(--green)" }} />Lucro</span>
            <span><span className="dot" style={{ background: "var(--red)" }} />Custos</span>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 22, textAlign: "center" }}>
          HARGROVE London · Shopify + Facebook Ads · {usingSample ? "dados de exemplo" : "dados reais"}
        </p>
      </main>
    </div>
  );
}
