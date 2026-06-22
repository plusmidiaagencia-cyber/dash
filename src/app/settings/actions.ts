"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_STORE_ID } from "@/lib/store";
import { validateShopify, validateFacebook } from "@/lib/providers";
import {
  saveConnection, saveCostSettings, saveStoreGoal, addAdjustment, deleteAdjustment,
} from "@/lib/data";

const STORE = DEFAULT_STORE_ID;

export async function connectShopify(formData: FormData) {
  const domain = String(formData.get("domain") || "").trim();
  const token = String(formData.get("token") || "").trim();
  if (!domain || !token) return;
  const v = await validateShopify(domain, token);
  await saveConnection(
    STORE, "shopify",
    { domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, "") },
    v.ok ? token : null,
    v.ok ? "connected" : "error",
    v.detail
  );
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function connectFacebook(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const accountId = String(formData.get("accountId") || "").trim();
  const pixelId = String(formData.get("pixelId") || "").trim();
  const apiVersion = String(formData.get("apiVersion") || "v21.0").trim();
  if (!token || !accountId) return;
  const v = await validateFacebook(token, accountId, apiVersion);
  await saveConnection(
    STORE, "facebook",
    { accountId: accountId.startsWith("act_") ? accountId : `act_${accountId}`, pixelId, apiVersion },
    v.ok ? token : null,
    v.ok ? "connected" : "error",
    v.detail
  );
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function saveCosts(formData: FormData) {
  const monthlyOperational = Number(formData.get("monthlyOperational") || 0);
  const shippingMode = String(formData.get("shippingMode") || "none");
  const shippingValue = Number(formData.get("shippingValue") || 0);
  const gatewayFeePercentFallback = Number(formData.get("gatewayFeePercentFallback") || 0) / 100;
  const revenueGoal = Number(formData.get("revenueGoal") || 0);
  await saveCostSettings(STORE, { monthlyOperational, shippingMode, shippingValue, gatewayFeePercentFallback });
  await saveStoreGoal(STORE, revenueGoal);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function createAdjustment(formData: FormData) {
  const date = String(formData.get("date") || "").trim();
  const label = String(formData.get("label") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!date || !amount) return;
  await addAdjustment(STORE, date, label, amount);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function removeAdjustment(formData: FormData) {
  const id = Number(formData.get("id") || 0);
  if (!id) return;
  await deleteAdjustment(STORE, id);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
