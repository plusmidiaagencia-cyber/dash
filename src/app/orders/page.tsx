import Sidebar from "@/components/Sidebar";
import SyncButton from "@/components/SyncButton";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { listOrders, getCostSettings } from "@/lib/data";
import { gbp } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusBadge(status: string | null) {
  const ok = status === "paid" || status === "partially_refunded";
  const cls = ok ? "up" : status === "refunded" || status === "voided" ? "down" : "flat";
  const label = { paid: "Aprovado", pending: "Pendente", refunded: "Reembolsado", voided: "Cancelado", partially_refunded: "Parcial" }[status || ""] || status || "—";
  return <span className={`delta ${cls}`}>● {label}</span>;
}

export default async function OrdersPage() {
  const STORE = DEFAULT_STORE_ID;
  const [orders, cost] = await Promise.all([listOrders(STORE, 100), getCostSettings(STORE)]);

  const freteOf = (rev: number) =>
    cost.shippingMode === "flat" ? cost.shippingValue : cost.shippingMode === "percent" ? rev * cost.shippingValue : 0;

  return (
    <div className="wrap">
      <Sidebar />
      <main className="main">
        <div className="top">
          <div className="store">
            <div className="av">🧾</div>
            <div><small>{orders.length} pedidos</small><b>Pedidos</b></div>
          </div>
          <div className="filters"><SyncButton /></div>
        </div>

        {orders.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <p className="muted">Nenhum pedido ainda. Conecte o Shopify em Configurações e clique em <b>Sincronizar Shopify</b>.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pedido</th><th>Data</th><th>Itens</th><th>Pagamento</th><th>Status</th>
                  <th>Receita</th><th>Custo Produtos</th><th>Mkt</th><th>Frete</th><th>Taxas</th><th>Impostos</th><th>Lucro</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const frete = freteOf(o.revenue);
                  const taxas = o.revenue * cost.gatewayFeePercentFallback;
                  const mkt = 0;
                  const lucro = o.revenue - o.cogs - mkt - frete - taxas - o.tax;
                  return (
                    <tr key={o.id}>
                      <td><b>{o.name}</b></td>
                      <td>{o.processedAt ? new Date(o.processedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td>{o.itemCount} ({o.units})</td>
                      <td>{o.gateway || "—"}</td>
                      <td>{statusBadge(o.status)}</td>
                      <td>{gbp(o.revenue)}</td>
                      <td>{gbp(o.cogs)}</td>
                      <td>{gbp(mkt)}</td>
                      <td>{gbp(frete)}</td>
                      <td>{gbp(taxas)}</td>
                      <td>{gbp(o.tax)}</td>
                      <td><span className={`profit-pill${lucro < 0 ? " neg" : ""}`}>{gbp(lucro)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginTop: 14 }}>
          Custo de marketing por pedido entra na Fase 2 (atribuição por UTM). Taxas usam o fallback de gateway até o Shopify Payments estar conectado.
        </p>
      </main>
    </div>
  );
}
