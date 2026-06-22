import Sidebar from "@/components/Sidebar";
import SyncButton from "@/components/SyncButton";
import Link from "next/link";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { getConnections } from "@/lib/data";
import { connectShopify, connectFacebook } from "./actions";

export const dynamic = "force-dynamic";

function StatusChip({ status, detail }: { status?: string; detail?: string }) {
  const map: Record<string, { cls: string; txt: string }> = {
    connected: { cls: "up", txt: "● Conectado" },
    connecting: { cls: "flat", txt: "◌ Conectando…" },
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

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const conns = await getConnections(DEFAULT_STORE_ID);
  const sh = conns.shopify;
  const fb = conns.facebook;

  return (
    <div className="wrap">
      <Sidebar />
      <main className="main">
        <div className="top">
          <div className="store">
            <div className="av">⚙️</div>
            <div><small>Configurações & Conexões</small><b>HARGROVE London</b></div>
          </div>
          <div className="filters">
            <SyncButton />
            <Link className="pill btn" href="/dashboard">← Painel</Link>
          </div>
        </div>

        {sp.error && <div className="banner" style={{ borderColor: "rgba(226,104,95,.4)", color: "var(--red)" }}>Erro na conexão: {sp.error}</div>}

        <h3 className="sec-title">Integrações</h3>
        <p className="muted" style={{ margin: "0 0 14px" }}>
          Conecte suas fontes de dados. As credenciais são guardadas criptografadas.
        </p>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Shopify (Access Token) */}
          <form className="card" action={connectShopify}>
            <h3>Shopify <span className="tag">e-commerce</span></h3>
            <div style={{ margin: "6px 0 10px" }}><StatusChip status={sh?.status} detail={sh?.detail} /></div>
            <label className="field"><span>Domínio da loja</span>
              <input name="domain" defaultValue={sh?.info.domain || ""} placeholder="sualoja.myshopify.com" required />
            </label>
            <label className="field"><span>Admin API access token</span>
              <input name="token" type="password" placeholder={sh?.status === "connected" ? "•••••• (já salvo — preencha p/ trocar)" : "shpat_..."} />
            </label>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Token em: Shopify admin → Settings → Apps → Develop apps → seu app → API credentials.
            </p>
            <button className="btn-primary" type="submit">{sh?.status === "connected" ? "Reconectar & sincronizar" : "Conectar Shopify"}</button>
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
      </main>
    </div>
  );
}
