"use client";

import { useState, useTransition } from "react";
import { runShopifySync } from "@/app/actions/sync";

export default function SyncButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <button
      type="button"
      className="pill btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setMsg("");
          const r = await runShopifySync();
          setMsg(r.ok ? `✓ ${r.products} produtos · ${r.orders} pedidos` : `✗ ${r.error}`);
        })
      }
    >
      {pending ? "Sincronizando…" : "🔄 Sincronizar Shopify"}
      {msg ? ` · ${msg}` : ""}
    </button>
  );
}
