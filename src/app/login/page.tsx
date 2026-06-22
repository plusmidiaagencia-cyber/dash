import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="auth">
      <div className="box">
        <h1>HARGROVE</h1>
        <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>Painel de métricas</p>
        <label className="field">
          <span>Email</span>
          <input type="email" placeholder="voce@hargrovelondon.com" />
        </label>
        <label className="field">
          <span>Senha</span>
          <input type="password" placeholder="••••••••" />
        </label>
        <Link href="/dashboard">
          <button className="btn-primary">Entrar</button>
        </Link>
        <p className="muted" style={{ textAlign: "center", marginTop: 16 }}>
          Login real (Supabase Auth) será ligado na implementação.
        </p>
      </div>
    </div>
  );
}
