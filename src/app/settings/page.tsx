import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { getConnections, getCostSettings, listAdjustments } from "@/lib/data";
import { gbp } from "@/lib/format";
import { connectShopify, connectFacebook, saveCosts, createAdjustment, removeAdjustment } from "./actions";

export const dynamic = "force-dynamic";

function StatusChip({ status, detail }: { status?: string; detail?: string }) {
  const map: Record<string, { cls: string; txt: string }> = {
    connected: { cls: "up", txt: "● Conectado" },
    error: { cls: "down", txt: "● Erro" },
    disconnected: { cls: "flat", txt: "○ Não conectado" },
  };
  const s = map[status || "disconnected"];
  return (
    <span>
      <span className={`delta ${s.cls}`}>{s.txt}</span>
      {detail ? <span className="muted" style={{ marginLeft: 8 }}>{detail}</span> : null}
    </span>
  );
}

export default async function SettingsPage() {
  const conns = await getConnections(DEFAULT_STORE_ID);
  const cost = await getCostSettings(DEFAULT_STORE_ID);
  const adjustments = await listAdjustments(DEFAULT_STORE_ID);
  const sh = conns.shopify;
  const fb = conns.facebook;

  return (
    <div className="wrap">
      <Sidebar />
      <main className="main">
        <div className="top">
          <div className="store">
            <div className="av">H</div>
            <div><small>Configurações & Conexões</small><b>HARGROVE London</b></div>
          </div>
          <Link className="pill btn" href="/dashboard">← Voltar ao painel</Link>
        </div>

        <h3 className="sec-title">Integrações</h3>
        <p className="muted" style={{ margin: "0 0 14px" }}>
          Conecte suas fontes de dados. Ao salvar, o token é <b>validado de verdade</b> e guardado criptografado.
        </p>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Shopify */}
          <form className="card" action={connectShopify}>
            <h3>Shopify <span className="tag">e-commerce</span></h3>
            <div style={{ margin: "6px 0 10px" }}><StatusChip status={sh?.status} detail={sh?.detail} /></div>
            <label className="field"><span>Domínio da loja</span>
              <input name="domain" defaultValue={sh?.info.domain || ""} placeholder="hargrovelondon.myshopify.com" required />
            </label>
            <label className="field"><span>Admin API access token</span>
              <input name="token" type="password" placeholder={sh?.status === "connected" ? "•••••• (já salvo — preencha p/ trocar)" : "shpat_..."} />
            </label>
            <button className="btn-primary" type="submit">{sh?.status === "connected" ? "Reconectar Shopify" : "Conectar Shopify"}</button>
          </form>

          {/* Facebook */}
          <form className="card" action={connectFacebook}>
            <h3>Facebook Ads <span className="tag">marketing</span></h3>
            <div style={{ margin: "6px 0 10px" }}><StatusChip status={fb?.status} detail={fb?.detail} /></div>
            <label className="field"><span>Access token</span>
              <input name="token" type="password" placeholder={fb?.status === "connected" ? "•••••• (já salvo — preencha p/ trocar)" : "EAAB..."} />
            </label>
            <label className="field"><span>Ad account</span>
              <input name="accountId" defaultValue={fb?.info.accountId || ""} placeholder="act_1001468169278058" required />
            </label>
            <label className="field"><span>Pixel ID</span>
              <input name="pixelId" defaultValue={fb?.info.pixelId || ""} placeholder="123456789" />
            </label>
            <input type="hidden" name="apiVersion" value="v21.0" />
            <button className="btn-primary" type="submit">{fb?.status === "connected" ? "Reconectar Facebook" : "Conectar Facebook"}</button>
          </form>
        </div>

        <h3 className="sec-title" style={{ marginTop: 28 }}>Custos & ajustes</h3>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Custos */}
          <form className="card" action={saveCosts}>
            <h3>Custos & Meta</h3>
            <label className="field"><span>Operacional mensal (£)</span>
              <input name="monthlyOperational" type="number" step="0.01" defaultValue={cost.monthlyOperational} />
            </label>
            <label className="field"><span>Frete que você paga</span>
              <select name="shippingMode" defaultValue={cost.shippingMode}>
                <option value="none">Já incluso no custo do produto (£0)</option>
                <option value="flat">Valor fixo por pedido</option>
                <option value="percent">% do faturamento</option>
              </select>
            </label>
            <label className="field"><span>Valor do frete (£ por pedido, ou fração p/ %)</span>
              <input name="shippingValue" type="number" step="0.0001" defaultValue={cost.shippingValue} />
            </label>
            <label className="field"><span>Taxa de gateway fallback (%)</span>
              <input name="gatewayFeePercentFallback" type="number" step="0.01" defaultValue={(cost.gatewayFeePercentFallback * 100).toFixed(2)} />
            </label>
            <label className="field"><span>Meta de faturamento (£)</span>
              <input name="revenueGoal" type="number" step="0.01" defaultValue={cost.revenueGoal} />
            </label>
            <button className="btn-primary" type="submit">Salvar custos & meta</button>
          </form>

          {/* Ajustes manuais */}
          <div className="card">
            <h3>Ajustes manuais <span className="tag">extras / créditos</span></h3>
            <form action={createAdjustment}>
              <label className="field"><span>Data</span><input name="date" type="date" required /></label>
              <label className="field"><span>Descrição</span><input name="label" placeholder="Ex.: chargeback pedido #1023" /></label>
              <label className="field"><span>Valor (£) — positivo = custo, negativo = crédito</span><input name="amount" type="number" step="0.01" placeholder="-45.00" required /></label>
              <button className="btn-primary" type="submit">Adicionar ajuste</button>
            </form>
            <div style={{ marginTop: 16 }}>
              {adjustments.length === 0 && <p className="muted">Nenhum ajuste lançado.</p>}
              {adjustments.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <span className="muted">{a.date} · {a.label || "—"}</span>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <b>{gbp(a.amount)}</b>
                    <form action={removeAdjustment}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="tag" style={{ cursor: "pointer", background: "none" }}>remover</button>
                    </form>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
