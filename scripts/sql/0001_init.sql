-- HARGROVE Painel — M1: schema + RLS + seed
-- Aplicado via scripts/apply-sql.mjs (conexão postgres pooler).
-- Idempotente: pode rodar de novo sem quebrar.

-- ============ TABELAS ============

create table if not exists accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id          uuid primary key,            -- = auth.users.id
  account_id  uuid not null references accounts(id) on delete cascade,
  role        text not null default 'owner',
  created_at  timestamptz not null default now()
);

create table if not exists stores (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  name          text not null,
  currency      text not null default 'GBP',
  revenue_goal  numeric(12,2) not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists connections (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  provider        text not null,                 -- 'shopify' | 'facebook'
  credentials     jsonb not null default '{}',   -- criptografado na aplicação
  status          text not null default 'disconnected',
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (store_id, provider)
);

create table if not exists orders (
  id               text primary key,             -- id do pedido no Shopify
  store_id         uuid not null references stores(id) on delete cascade,
  created_at_shop  timestamptz,
  processed_at     timestamptz,
  financial_status text,
  total            numeric(12,2) not null default 0,
  subtotal         numeric(12,2) not null default 0,
  total_discounts  numeric(12,2) not null default 0,
  currency         text not null default 'GBP',
  gateway          text,
  transaction_fee  numeric(12,2) not null default 0,
  refunded_amount  numeric(12,2) not null default 0,
  raw              jsonb,
  inserted_at      timestamptz not null default now()
);
create index if not exists idx_orders_store_processed on orders (store_id, processed_at);

create table if not exists order_items (
  id          bigint generated always as identity primary key,
  order_id    text not null references orders(id) on delete cascade,
  store_id    uuid not null references stores(id) on delete cascade,
  product_id  text,
  variant_id  text,
  title       text,
  quantity    integer not null default 1,
  unit_price  numeric(12,2) not null default 0,
  unit_cost   numeric(12,2) not null default 0
);
create index if not exists idx_order_items_order on order_items (order_id);

create table if not exists refunds (
  id          text primary key,                  -- id do refund no Shopify
  order_id    text references orders(id) on delete cascade,
  store_id    uuid not null references stores(id) on delete cascade,
  created_at  timestamptz not null default now(),
  amount      numeric(12,2) not null default 0
);

create table if not exists ad_spend_daily (
  id                bigint generated always as identity primary key,
  store_id          uuid not null references stores(id) on delete cascade,
  date              date not null,
  spend             numeric(12,2) not null default 0,
  page_views        integer not null default 0,
  view_content      integer not null default 0,
  add_to_cart       integer not null default 0,
  initiate_checkout integer not null default 0,
  purchases         integer not null default 0,
  updated_at        timestamptz not null default now(),
  unique (store_id, date)
);

create table if not exists cost_settings (
  store_id                      uuid primary key references stores(id) on delete cascade,
  monthly_operational           numeric(12,2) not null default 0,
  shipping_mode                 text not null default 'none',   -- none|flat|percent
  shipping_value                numeric(12,4) not null default 0,
  gateway_fee_percent_fallback  numeric(6,4) not null default 0.0290,
  updated_at                    timestamptz not null default now()
);

create table if not exists manual_adjustments (
  id          bigint generated always as identity primary key,
  store_id    uuid not null references stores(id) on delete cascade,
  date        date not null,
  label       text,
  amount      numeric(12,2) not null default 0,  -- positivo = custo, negativo = crédito
  created_at  timestamptz not null default now()
);

-- ============ RLS (deny-by-default p/ anon/authenticated) ============
-- O servidor acessa via role 'postgres' (BYPASSRLS), então continua funcionando.
-- Sem políticas permissivas => Data API pública não lê nada destas tabelas.

alter table accounts            enable row level security;
alter table profiles            enable row level security;
alter table stores              enable row level security;
alter table connections         enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table refunds             enable row level security;
alter table ad_spend_daily      enable row level security;
alter table cost_settings       enable row level security;
alter table manual_adjustments  enable row level security;

-- ============ SEED (HARGROVE) ============
insert into accounts (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Plus Midia')
on conflict (id) do nothing;

insert into stores (id, account_id, name, currency, revenue_goal)
values ('00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001',
        'HARGROVE London', 'GBP', 10000)
on conflict (id) do nothing;

insert into cost_settings (store_id, monthly_operational, shipping_mode, shipping_value, gateway_fee_percent_fallback)
values ('00000000-0000-0000-0000-000000000010', 180, 'none', 0, 0.0290)
on conflict (store_id) do nothing;
