import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="side">
      <div className="logo">H</div>
      <nav className="nav">
        <Link className="on" href="/dashboard" aria-label="Dashboard"><i /></Link>
        <Link href="/settings" aria-label="Configurações"><i /></Link>
        <Link href="/login" aria-label="Sair"><i /></Link>
      </nav>
    </aside>
  );
}
