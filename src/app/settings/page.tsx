import Sidebar from "@/components/Sidebar";

export default function SettingsPage() {
  return (
    <div className="wrap">
      <Sidebar />
      <main className="main">
        <div className="top">
          <div className="store">
            <div className="av">H</div>
            <div>
              <small>Configurações</small>
              <b>HARGROVE London</b>
            </div>
          </div>
        </div>

        <div className="banner">
          ⓘ Telas de exemplo. Salvar/conectar de verdade será ligado na implementação (M3).
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="card">
            <h3>Conexão — Shopify</h3>
            <label className="field"><span>Domínio da loja</span><input placeholder="hargrovelondon.myshopify.com" /></label>
            <label className="field"><span>Admin API token</span><input placeholder="shpat_..." /></label>
            <button className="btn-primary">Conectar Shopify</button>
          </div>

          <div className="card">
            <h3>Conexão — Facebook Ads</h3>
            <label className="field"><span>Access token</span><input placeholder="EAAB..." /></label>
            <label className="field"><span>Ad account</span><input placeholder="act_1001468169278058" /></label>
            <label className="field"><span>Pixel ID</span><input placeholder="123456789" /></label>
            <button className="btn-primary">Conectar Facebook</button>
          </div>

          <div className="card">
            <h3>Custos</h3>
            <label className="field"><span>Operacional mensal (£)</span><input placeholder="180" /></label>
            <label className="field">
              <span>Frete que você paga</span>
              <select>
                <option>Já incluso no custo do produto (£0)</option>
                <option>Valor fixo por pedido</option>
                <option>% do faturamento</option>
              </select>
            </label>
            <label className="field"><span>Taxa de gateway fallback (%)</span><input placeholder="2.9" /></label>
            <button className="btn-primary">Salvar custos</button>
          </div>

          <div className="card">
            <h3>Meta & ajustes</h3>
            <label className="field"><span>Meta de faturamento (£)</span><input placeholder="10000" /></label>
            <label className="field"><span>Ajuste manual — descrição</span><input placeholder="Ex.: chargeback pedido #1023" /></label>
            <label className="field"><span>Ajuste manual — valor (£)</span><input placeholder="-45.00" /></label>
            <button className="btn-primary">Salvar</button>
          </div>
        </div>
      </main>
    </div>
  );
}
