"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runAllSync } from "@/app/actions/sync";

export default function SyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const router = useRouter();

  return (
    <button
      type="button"
      className="pill btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setMsg("");
          const r = await runAllSync();
          router.refresh();
          setMsg(
            r.ok
              ? `✓ ${r.orders} pedidos · ${r.products} prod · ${r.fbDays}d ads`
              : `✗ ${r.error}`
          );
        })
      }
      title="Sincroniza pedidos (Shopify) e gasto (Facebook) e atualiza a página"
    >
      {pending ? "🔄 Atualizando…" : "🔄 Atualizar"}
      {msg ? ` · ${msg}` : ""}
    </button>
  );
}
