/**
 * Schema Drizzle — espelha scripts/sql/0001_init.sql.
 * Fonte de tipos para queries do servidor (M3+).
 */
import {
  pgTable, uuid, text, timestamp, numeric, integer, date, jsonb, bigint, unique, index,
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("GBP"),
  revenueGoal: numeric("revenue_goal", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  credentials: jsonb("credentials").notNull().default({}),
  status: text("status").notNull().default("disconnected"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique().on(t.storeId, t.provider) }));

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  createdAtShop: timestamp("created_at_shop", { withTimezone: true }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  financialStatus: text("financial_status"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDiscounts: numeric("total_discounts", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("GBP"),
  gateway: text("gateway"),
  transactionFee: numeric("transaction_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  refundedAmount: numeric("refunded_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  raw: jsonb("raw"),
  insertedAt: timestamp("inserted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ idx: index("idx_orders_store_processed").on(t.storeId, t.processedAt) }));

export const orderItems = pgTable("order_items", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  productId: text("product_id"),
  variantId: text("variant_id"),
  title: text("title"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
}, (t) => ({ idx: index("idx_order_items_order").on(t.orderId) }));

export const refunds = pgTable("refunds", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
});

export const adSpendDaily = pgTable("ad_spend_daily", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  spend: numeric("spend", { precision: 12, scale: 2 }).notNull().default("0"),
  pageViews: integer("page_views").notNull().default(0),
  viewContent: integer("view_content").notNull().default(0),
  addToCart: integer("add_to_cart").notNull().default(0),
  initiateCheckout: integer("initiate_checkout").notNull().default(0),
  purchases: integer("purchases").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ uq: unique().on(t.storeId, t.date) }));

export const costSettings = pgTable("cost_settings", {
  storeId: uuid("store_id").primaryKey().references(() => stores.id, { onDelete: "cascade" }),
  monthlyOperational: numeric("monthly_operational", { precision: 12, scale: 2 }).notNull().default("0"),
  shippingMode: text("shipping_mode").notNull().default("none"),
  shippingValue: numeric("shipping_value", { precision: 12, scale: 4 }).notNull().default("0"),
  gatewayFeePercentFallback: numeric("gateway_fee_percent_fallback", { precision: 6, scale: 4 }).notNull().default("0.0290"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const manualAdjustments = pgTable("manual_adjustments", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  label: text("label"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
