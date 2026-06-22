"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { label: string; href?: string; icon: string; soon?: boolean; children?: { label: string; href: string }[] };

const NAV: Item[] = [
  { label: "Início", href: "/dashboard", icon: "🏠" },
  { label: "Pedidos", href: "/orders", icon: "🧾" },
  { label: "Produtos", icon: "📦", children: [{ label: "Custos de Produto", href: "/products/costs" }] },
  { label: "Marketing", icon: "📣", soon: true },
  { label: "Rastreio", icon: "🚚", soon: true },
  { label: "Financeiro", icon: "🏦", soon: true },
  { label: "Configurações", href: "/settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname() || "";
  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <aside className="side">
      <div className="side-brand">
        <div className="logo">H</div>
        <span className="side-wordmark">HARGROVE</span>
      </div>

      <nav className="nav">
        {NAV.map((item) => {
          if (item.soon) {
            return (
              <div key={item.label} className="nav-item soon" aria-disabled>
                <span className="nav-ic">{item.icon}</span>
                <span className="nav-txt">{item.label}</span>
                <span className="tag">em breve</span>
              </div>
            );
          }
          if (item.children) {
            return (
              <div key={item.label}>
                <div className="nav-item nav-group">
                  <span className="nav-ic">{item.icon}</span>
                  <span className="nav-txt">{item.label}</span>
                </div>
                <div className="nav-sub">
                  {item.children.map((c) => (
                    <Link key={c.href} href={c.href} className={`nav-subitem${isActive(c.href) ? " on" : ""}`}>{c.label}</Link>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <Link key={item.href} href={item.href!} className={`nav-item${isActive(item.href!) ? " on" : ""}`}>
              <span className="nav-ic">{item.icon}</span>
              <span className="nav-txt">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Link href="/login" className="nav-item nav-foot">
        <span className="nav-ic">↩</span>
        <span className="nav-txt">Sair</span>
      </Link>
    </aside>
  );
}
