/** Carrega eventos crus do banco para um período e calcula os KPIs. */
import { sql } from "@/db";
import { computeKpis, type RawOrder, type DaySpend } from "./metrics";
import { getCostSettings } from "./data";

export type Range = { from: string; to: string };

export async function loadKpis(storeId: string, range: Range) {
  const s = sql();

  const orderRows = await s<
    {
      id: string;
      date: string;
      financial_status: string | null;
      total: string;
      refunded_amount: string;
      transaction_fee: string;
    }[]
  >`
    select id,
           coalesce(processed_at, created_at_shop)::date::text as date,
           financial_status, total, refunded_amount, transaction_fee
    from orders
    where store_id = ${storeId}
      and coalesce(processed_at, created_at_shop)::date between ${range.from} and ${range.to}
  `;

  const itemRows = orderRows.length
    ? await s<{ order_id: string; quantity: number; unit_price: string; unit_cost: string }[]>`
        select order_id, quantity, unit_price, unit_cost
        from order_items
        where store_id = ${storeId} and order_id in ${s(orderRows.map((o) => o.id))}
      `
    : [];

  const itemsByOrder = new Map<string, RawOrder["items"]>();
  for (const it of itemRows) {
    const arr = itemsByOrder.get(it.order_id) ?? [];
    arr.push({ quantity: it.quantity, unitPrice: Number(it.unit_price), unitCost: Number(it.unit_cost) });
    itemsByOrder.set(it.order_id, arr);
  }

  const orders: RawOrder[] = orderRows.map((o) => ({
    id: o.id,
    date: o.date,
    financialStatus: (o.financial_status as RawOrder["financialStatus"]) ?? "paid",
    total: Number(o.total),
    refundedAmount: Number(o.refunded_amount),
    transactionFee: Number(o.transaction_fee),
    items: itemsByOrder.get(o.id) ?? [],
  }));

  const spendRows = await s<
    {
      date: string;
      spend: string;
      page_views: number;
      view_content: number;
      add_to_cart: number;
      initiate_checkout: number;
      purchases: number;
    }[]
  >`
    select date::text, spend, page_views, view_content, add_to_cart, initiate_checkout, purchases
    from ad_spend_daily
    where store_id = ${storeId} and date between ${range.from} and ${range.to}
  `;

  const spend: DaySpend[] = spendRows.map((d) => ({
    date: d.date,
    spend: Number(d.spend),
    pageViews: d.page_views,
    viewContent: d.view_content,
    addToCart: d.add_to_cart,
    initiateCheckout: d.initiate_checkout,
    purchases: d.purchases,
  }));

  const settings = await getCostSettings(storeId);
  return computeKpis(orders, spend, settings, range);
}
