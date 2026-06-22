"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIOD_LABELS } from "@/lib/range";
import { CURRENCIES } from "@/lib/fx";

const FLAG: Record<string, string> = { GBP: "🇬🇧", USD: "🇺🇸", EUR: "🇪🇺", BRL: "🇧🇷" };

export default function Toolbar({
  period, currency, from, to,
}: { period: string; currency: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParams(updates: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <>
      <select
        className="pill"
        value={period}
        onChange={(e) => setParams(e.target.value === "custom" ? { period: "custom" } : { period: e.target.value, from: "", to: "" })}
        aria-label="Período"
      >
        {Object.entries(PERIOD_LABELS).map(([k, l]) => (
          <option key={k} value={k}>📅 {l}</option>
        ))}
      </select>

      {period === "custom" && (
        <>
          <input className="pill" type="date" value={from} max={to || undefined} onChange={(e) => setParams({ from: e.target.value })} aria-label="De" />
          <input className="pill" type="date" value={to} min={from || undefined} onChange={(e) => setParams({ to: e.target.value })} aria-label="Até" />
        </>
      )}

      <select className="pill" value={currency} onChange={(e) => setParams({ cur: e.target.value })} aria-label="Moeda">
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>{FLAG[c]} {c}</option>
        ))}
      </select>
    </>
  );
}
