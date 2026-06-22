-- M4 — produtos/variantes + colunas extras de pedido (puxados do Shopify)

create table if not exists products (
  id          text primary key,              -- product id do Shopify
  store_id    uuid not null references stores(id) on delete cascade,
  title       text,
  image       text,
  status      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_products_store on products (store_id);

create table if not exists product_variants (
  id           text primary key,             -- variant id do Shopify
  product_id   text references products(id) on delete cascade,
  store_id     uuid not null references stores(id) on delete cascade,
  title        text,
  sku          text,
  price        numeric(12,2) not null default 0,
  cost         numeric(12,2) not null default 0,   -- custo efetivo (shopify ou manual)
  cost_source  text not null default 'none',       -- 'shopify' | 'manual' | 'none'
  updated_at   timestamptz not null default now()
);
create index if not exists idx_variants_product on product_variants (product_id);
create index if not exists idx_variants_store on product_variants (store_id);

alter table products         enable row level security;
alter table product_variants enable row level security;

-- colunas extras nos pedidos
alter table orders add column if not exists order_name text;
alter table orders add column if not exists total_tax numeric(12,2) not null default 0;

-- marca da última sincronização por provider (reusa connections.last_synced_at)
