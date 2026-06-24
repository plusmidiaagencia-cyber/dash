"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { runFullSync } from "@/lib/shopify-sync";
import { syncFacebook } from "@/lib/facebook-sync";

/** Sincroniza Shopify (produtos + pedidos) E Facebook (gasto + funil) de uma loja. */
export async function runAllSync(storeId: string = DEFAULT_STORE_ID) {
  let products = 0, orders = 0, fbDays = 0;
  const errors: string[] = [];

  try {
    const r = await runFullSync(storeId);
    products = r.products;
    orders = r.orders;
  } catch (e) {
    errors.push(`Shopify: ${(e as Error).message}`);
  }

  try {
    fbDays = await syncFacebook(storeId);
  } catch (e) {
    errors.push(`Facebook: ${(e as Error).message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/products/costs");
  revalidatePath("/settings");

  return { ok: errors.length === 0, products, orders, fbDays, error: errors.join(" · ") };
}
