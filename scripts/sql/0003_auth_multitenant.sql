-- 0003: Multi-tenant com login (Supabase Auth)
-- - Trigger provisiona account+profile+store+cost_settings ao criar um usuário.
-- - RPCs passam a resolver a loja por auth.uid() (em vez de loja fixa).
-- - EXECUTE das RPCs só para 'authenticated' (anon/public perdem acesso).

-- ============ 1) Provisionamento de novo usuário ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account uuid;
  new_store uuid;
  ws text;
begin
  ws := coalesce(nullif(trim(new.raw_user_meta_data->>'workspace_name'), ''), split_part(new.email, '@', 1));
  insert into accounts (name) values (ws) returning id into new_account;
  insert into profiles (id, account_id, role) values (new.id, new_account, 'owner');
  insert into stores (account_id, name, currency, revenue_goal)
    values (new_account, ws, 'GBP', 0) returning id into new_store;
  insert into cost_settings (store_id) values (new_store);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ 2) RPC dashboard_data (escopo por auth.uid) ============
create or replace function public.dashboard_data(p_from date, p_to date)
returns json
language sql
security definer
set search_path to 'public'
as $function$
  with store_id as (
    select s.id from stores s
    join profiles pr on pr.account_id = s.account_id
    where pr.id = auth.uid()
    order by s.created_at asc
    limit 1)
  select json_build_object(
    'store', (select row_to_json(s) from (
        select name, currency, revenue_goal from stores where id = (select id from store_id)) s),
    'connections', (select coalesce(json_object_agg(provider, status), '{}'::json)
        from connections where store_id = (select id from store_id)),
    'settings', (select row_to_json(c) from (
        select monthly_operational, shipping_mode, shipping_value, gateway_fee_percent_fallback
        from cost_settings where store_id = (select id from store_id)) c),
    'orders', (select coalesce(json_agg(o), '[]'::json) from (
        select id,
               coalesce(processed_at, created_at_shop)::date::text as date,
               financial_status, total, refunded_amount, transaction_fee, total_tax
        from orders
        where store_id = (select id from store_id)
          and coalesce(processed_at, created_at_shop)::date between p_from and p_to) o),
    'items', (select coalesce(json_agg(i), '[]'::json) from (
        select oi.order_id, oi.quantity, oi.unit_price, oi.unit_cost
        from order_items oi
        join orders o on o.id = oi.order_id
        where oi.store_id = (select id from store_id)
          and coalesce(o.processed_at, o.created_at_shop)::date between p_from and p_to) i),
    'spend', (select coalesce(json_agg(s), '[]'::json) from (
        select date::text, spend, page_views, view_content, add_to_cart, initiate_checkout, purchases
        from ad_spend_daily
        where store_id = (select id from store_id) and date between p_from and p_to) s),
    'adjustments', (select coalesce(json_agg(a), '[]'::json) from (
        select date::text, amount from manual_adjustments
        where store_id = (select id from store_id) and date between p_from and p_to) a)
  );
$function$;

-- ============ 3) RPC products_data (escopo por auth.uid) ============
create or replace function public.products_data()
returns json
language sql
security definer
set search_path to 'public'
as $function$
  with store_id as (
    select s.id from stores s
    join profiles pr on pr.account_id = s.account_id
    where pr.id = auth.uid()
    order by s.created_at asc
    limit 1)
  select coalesce(json_agg(p), '[]'::json) from (
    select p.id, p.title, p.image,
      count(v.id) as variants_total,
      count(v.id) filter (where v.cost > 0) as variants_with_cost,
      coalesce(min(v.cost), 0) as cost_min,
      coalesce(max(v.cost), 0) as cost_max,
      coalesce((select sum(oi.quantity) from order_items oi where oi.product_id = p.id), 0) as total_sales
    from products p
    left join product_variants v on v.product_id = p.id
    where p.store_id = (select id from store_id)
    group by p.id, p.title, p.image
    order by total_sales desc, p.title asc
  ) p;
$function$;

-- ============ 4) Grants: só usuários autenticados ============
revoke execute on function public.dashboard_data(date, date) from public, anon;
revoke execute on function public.products_data() from public, anon;
grant execute on function public.dashboard_data(date, date) to authenticated;
grant execute on function public.products_data() to authenticated;
