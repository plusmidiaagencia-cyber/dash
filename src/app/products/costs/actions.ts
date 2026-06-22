"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { setProductCost, applyCostToAll } from "@/lib/data";

export async function setCost(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const cost = Number(formData.get("cost") || 0);
  if (!productId) return;
  await setProductCost(DEFAULT_STORE_ID, productId, cost);
  revalidatePath("/products/costs");
  revalidatePath("/dashboard");
  revalidatePath("/orders");
}

export async function applyAll(formData: FormData) {
  const cost = Number(formData.get("cost") || 0);
  await applyCostToAll(DEFAULT_STORE_ID, cost);
  revalidatePath("/products/costs");
  revalidatePath("/dashboard");
  revalidatePath("/orders");
}
