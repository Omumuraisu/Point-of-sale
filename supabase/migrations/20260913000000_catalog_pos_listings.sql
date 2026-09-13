alter table public.products_list
  add column if not exists archived_at timestamptz;

alter table public.sales_transaction
  add column if not exists product_listing_id text,
  add column if not exists catalog_product_id uuid,
  add column if not exists sold_quantity numeric,
  add column if not exists sold_unit text;

-- Preserve every historical row (and its sales FK) while allowing only one
-- active stall listing for a shared catalog identity.
with ranked as (
  select id,
         row_number() over (
           partition by stall_number, catalog_product_id
           order by coalesce(updated_at_ms, created_at_ms) desc, id desc
         ) as position
  from public.products_list
  where catalog_product_id is not null and archived_at is null
)
update public.products_list p
set archived_at = now(), updated_at_ms = (extract(epoch from now()) * 1000)::bigint
from ranked r
where p.id = r.id and r.position > 1;

create unique index if not exists products_list_one_active_catalog_per_stall
  on public.products_list(stall_number, catalog_product_id)
  where catalog_product_id is not null and archived_at is null;

create or replace function public.get_pos_product_catalog()
returns table(
  category_id uuid, category_name text, display_order integer,
  section_id uuid, section_name text,
  product_id uuid, product_name text, variant text
)
language sql security definer stable set search_path to ''
as $function$
  select c.id, c.name, c.display_order, s.id, s.name, p.id, p.name, p.variant
  from public.product_categories c
  join public.product_sections s on s.category_id = c.id
  join public.product_catalog p on p.section_id = s.id
  where auth.uid() is not null and p.is_public
  order by c.display_order, c.name, s.name, p.name, p.variant
$function$;

create or replace function public.create_catalog_listing(
  p_listing_id text,
  p_stall_number text,
  p_name text,
  p_main_category text,
  p_section text,
  p_price numeric,
  p_unit text,
  p_category_id text,
  p_category_label text,
  p_variant text default ''::text
) returns public.products_list
language plpgsql security definer set search_path to ''
as $function$
declare
  prod uuid;
  result public.products_list;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business b
    join public.business_owner o on o.business_owner_id = b.business_owner_id
    join public.accounts a on a.account_id = o.account_id
    where b.stall_number = p_stall_number and a.auth_user_id = auth.uid()
      and o.archived_at is null and a.status::text = 'active'
  ) then
    raise exception 'Not authorized for this stall' using errcode = '42501';
  end if;
  if p_price is null or p_price <= 0 or p_price >= 'Infinity'::numeric
     or coalesce(btrim(p_unit), '') = '' or coalesce(btrim(p_listing_id), '') = '' then
    raise exception 'Positive price, unit and listing ID are required';
  end if;

  prod := public.ensure_price_product(p_main_category, p_section, p_name, p_variant);

  select * into result from public.products_list where id = p_listing_id;
  if found and (result.stall_number <> p_stall_number or result.catalog_product_id is distinct from prod) then
    raise exception 'Listing ID already belongs to another listing';
  end if;

  select * into result
  from public.products_list
  where stall_number = p_stall_number and catalog_product_id = prod and archived_at is null
  for update;

  if found then
    update public.products_list
    set name = btrim(p_name), category_id = p_category_id, category_label = p_category_label,
        price_per_unit = p_price, unit = public.price_unit(p_unit), updated_at_ms = now_ms
    where id = result.id returning * into result;
    return result;
  end if;

  insert into public.products_list(
    id, stall_number, name, category_id, category_label, price_per_unit, unit,
    created_at_ms, updated_at_ms, catalog_product_id, archived_at
  ) values (
    p_listing_id, p_stall_number, btrim(p_name), p_category_id, p_category_label,
    p_price, public.price_unit(p_unit), now_ms, now_ms, prod, null
  ) returning * into result;
  return result;
exception when unique_violation then
  select * into result from public.products_list
  where stall_number = p_stall_number and catalog_product_id = prod and archived_at is null;
  if result.id is null then raise; end if;
  update public.products_list
  set price_per_unit = p_price, unit = public.price_unit(p_unit), updated_at_ms = now_ms
  where id = result.id returning * into result;
  return result;
end
$function$;

create or replace function public.update_catalog_listing(
  p_listing_id text, p_stall_number text, p_price numeric, p_unit text
) returns public.products_list
language plpgsql security definer set search_path to ''
as $function$
declare result public.products_list;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business b
    join public.business_owner o on o.business_owner_id = b.business_owner_id
    join public.accounts a on a.account_id = o.account_id
    where b.stall_number = p_stall_number and a.auth_user_id = auth.uid()
      and o.archived_at is null and a.status::text = 'active'
  ) then raise exception 'Not authorized for this stall' using errcode = '42501'; end if;
  if p_price is null or p_price <= 0 or p_price >= 'Infinity'::numeric or coalesce(btrim(p_unit), '') = '' then
    raise exception 'Positive price and unit are required';
  end if;
  update public.products_list
  set price_per_unit = p_price, unit = public.price_unit(p_unit),
      updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_listing_id and stall_number = p_stall_number and archived_at is null
  returning * into result;
  if result.id is null then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  return result;
end
$function$;

create or replace function public.get_catalog_listings(p_stall_number text)
returns table(
  id text, stall_number text, name text, category_id text, category_label text,
  price_per_unit numeric, unit text, created_at_ms bigint, updated_at_ms bigint,
  catalog_product_id uuid, archived_at timestamptz,
  main_category text, section_name text, catalog_variant text
)
language plpgsql security definer stable set search_path to ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.business b
    join public.business_owner o on o.business_owner_id = b.business_owner_id
    join public.accounts a on a.account_id = o.account_id
    where b.stall_number = p_stall_number and a.auth_user_id = auth.uid()
      and o.archived_at is null and a.status::text = 'active'
  ) then raise exception 'Not authorized for this stall' using errcode = '42501'; end if;
  return query
    select l.id, l.stall_number, l.name, l.category_id, l.category_label,
      l.price_per_unit, l.unit, l.created_at_ms, l.updated_at_ms,
      l.catalog_product_id, l.archived_at,
      c.name, s.name, p.variant
    from public.products_list l
    left join public.product_catalog p on p.id = l.catalog_product_id
    left join public.product_sections s on s.id = p.section_id
    left join public.product_categories c on c.id = s.category_id
    where l.stall_number = p_stall_number and l.archived_at is null
    order by coalesce(l.updated_at_ms, l.created_at_ms) desc;
end
$function$;

create or replace function public.archive_catalog_listing(p_listing_id text, p_stall_number text)
returns public.products_list
language plpgsql security definer set search_path to ''
as $function$
declare result public.products_list;
begin
  if auth.uid() is null or not exists (
    select 1 from public.business b
    join public.business_owner o on o.business_owner_id = b.business_owner_id
    join public.accounts a on a.account_id = o.account_id
    where b.stall_number = p_stall_number and a.auth_user_id = auth.uid()
      and o.archived_at is null and a.status::text = 'active'
  ) then raise exception 'Not authorized for this stall' using errcode = '42501'; end if;
  update public.products_list
  set archived_at = now(), updated_at_ms = (extract(epoch from now()) * 1000)::bigint
  where id = p_listing_id and stall_number = p_stall_number and archived_at is null
  returning * into result;
  if result.id is null then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  return result;
end
$function$;

revoke all on function public.create_catalog_listing(text,text,text,text,text,numeric,text,text,text,text) from public;
revoke all on function public.get_pos_product_catalog() from public;
revoke all on function public.update_catalog_listing(text,text,numeric,text) from public;
revoke all on function public.get_catalog_listings(text) from public;
revoke all on function public.archive_catalog_listing(text,text) from public;
grant execute on function public.create_catalog_listing(text,text,text,text,text,numeric,text,text,text,text) to authenticated;
grant execute on function public.get_pos_product_catalog() to authenticated;
grant execute on function public.update_catalog_listing(text,text,numeric,text) to authenticated;
grant execute on function public.get_catalog_listings(text) to authenticated;
grant execute on function public.archive_catalog_listing(text,text) to authenticated;
