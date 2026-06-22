"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { runFullSync } from "@/lib/shopify-sync";

export async function runShopifySync() {
  try {
    const r = await runFullSync(DEFAULT_STORE_ID);
    revalidatePath("/dashboard");
    revalidatePath("/orders");
    revalidatePath("/products/costs");
    return { ok: true as const, products: r.products, orders: r.orders };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
