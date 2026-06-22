import Sidebar from "@/components/Sidebar";
import SyncButton from "@/components/SyncButton";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { listProductsWithStats } from "@/lib/data";
import { gbp } from "@/lib/format";
import { setCost, applyAll } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductCostsPage() {
  const products = await listProductsWithStats(DEFAULT_STORE_ID);

  return (
    <div className="wrap">
      <Sidebar />
      <main className="main">
        <div className="top">
          <div className="store">
            <div className="av">💷</div>
            <div><small>{products.length} produtos</small><b>Custos de Produto</b></div>
          </div>
          <div className="filters"><SyncButton /></div>
        </div>

        {/* aplicar para todos */}
        <form className="card" action={applyAll} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <label className="field" style={{ margin: 0, flex: "0 0 200px" }}>
            <span>Custo (£) para TODOS os produtos</span>
            <input name="cost" type="number" step="0.01" placeholder="0.00" required />
          </label>
          <button className="btn-primary" type="submit" style={{ width: "auto", marginTop: 0 }}>Aplicar para todos</button>
          <span className="muted">Sobrescreve o custo de todas as variantes. O custo do Shopify é puxado automático no sync.</span>
        </form>

        {products.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <p className="muted">Nenhum produto ainda. Conecte o Shopify em Configurações e clique em <b>Sincronizar Shopify</b>.</p>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Produto</th><th>Variantes c/ custo</th><th>Total de Vendas</th><th>Custo atual</th><th>Definir custo (£)</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p.image ? <img className="thumb" src={p.image} alt="" /> : <span className="thumb" />}
                      <span>{p.title}</span>
                    </td>
                    <td>{p.variantsWithCost}/{p.variantsTotal}</td>
                    <td>{p.totalSales}</td>
                    <td>{p.costMax > 0 ? (p.costMin === p.costMax ? gbp(p.costMin) : `${gbp(p.costMin)}–${gbp(p.costMax)}`) : <span className="muted">sem custo</span>}</td>
                    <td>
                      <form action={setCost} style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <input type="hidden" name="productId" value={p.id} />
                        <input name="cost" type="number" step="0.01" defaultValue={p.costMax || ""} placeholder="0.00" style={{ width: 90, background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", color: "var(--ink)" }} />
                        <button type="submit" className="pill btn" style={{ padding: "6px 12px" }}>Salvar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
