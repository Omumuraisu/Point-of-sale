create or replace function public.operational_reset_preflight()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth', 'pg_catalog'
as $$
declare
  targets text[] := public.operational_reset_target_tables();
  table_name text;
  counts jsonb := '{}'::jsonb;
  preserved_counts jsonb := '{}'::jsonb;
  owners jsonb := '[]'::jsonb;
  dependencies jsonb := '[]'::jsonb;
  protected_account_conflicts jsonb := '[]'::jsonb;
begin
  foreach table_name in array targets loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select jsonb_set($1, array[$2], to_jsonb(count(*))) from public.%I', table_name)
        into counts using counts, table_name;
    end if;
  end loop;

  for table_name in
    select preserved_table
    from unnest(array[
      'leeo_staff', 'delivery_operator', 'stalls', 'audit_logs', 'expenses',
      'products_list', 'mnkde_network_edges'
    ]::text[]) as preserved_table
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('select jsonb_set($1, array[$2], to_jsonb(count(*))) from public.%I', table_name)
        into preserved_counts using preserved_counts, table_name;
    end if;
  end loop;

  if to_regclass('public.business_owner') is not null
     and to_regclass('public.accounts') is not null then
    execute $query$
      select coalesce(jsonb_agg(identity_row order by identity_row->>'identity_type', identity_row->>'account_id'), '[]'::jsonb)
      from (
        select to_jsonb(a) || jsonb_build_object(
          'identity_type', 'business_owner', 'business_owner_id', bo.business_owner_id
        ) as identity_row
        from public.business_owner bo
        join public.accounts a on a.account_id = bo.account_id
        union all
        select to_jsonb(a) || jsonb_build_object(
          'identity_type', 'vendor', 'vendor_id', v.vendor_id,
          'business_owner_id', v.business_owner_id
        ) as identity_row
        from public.vendor v
        join public.accounts a on a.account_id = v.account_id
      ) identities
    $query$ into owners;
  end if;

  if to_regclass('public.accounts') is not null
     and to_regclass('public.business_owner') is not null then
    execute $query$
      with removed_accounts as (
        select account_id from public.business_owner
        union
        select account_id from public.vendor
      ), protected_accounts as (
        select 'leeo_staff'::text as source, account_id from public.leeo_staff
        union all
        select 'delivery_operator'::text as source, account_id from public.delivery_operator
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'account_id', protected.account_id, 'protected_by', protected.source
      )), '[]'::jsonb)
      from protected_accounts protected
      join removed_accounts removed using (account_id)
    $query$ into protected_account_conflicts;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'constraint', c.conname,
    'referencing_table', src.relname,
    'target_table', dst.relname,
    'delete_action', case c.confdeltype
      when 'a' then 'no_action' when 'r' then 'restrict' when 'c' then 'cascade'
      when 'n' then 'set_null' when 'd' then 'set_default' else c.confdeltype::text end
  ) order by dst.relname, src.relname), '[]'::jsonb)
  into dependencies
  from pg_constraint c
  join pg_class src on src.oid = c.conrelid
  join pg_namespace src_ns on src_ns.oid = src.relnamespace
  join pg_class dst on dst.oid = c.confrelid
  join pg_namespace dst_ns on dst_ns.oid = dst.relnamespace
  where c.contype = 'f'
    and src_ns.nspname = 'public'
    and dst_ns.nspname = 'public'
    and (dst.relname = any(targets) or dst.relname = 'accounts')
    and not (src.relname = any(targets));

  return jsonb_build_object(
    'generated_at', clock_timestamp(),
    'database', current_database(),
    'tables', counts,
    'preserved_counts', preserved_counts,
    'owners', owners,
    'protected_account_conflicts', protected_account_conflicts,
    'external_dependencies', dependencies,
    'preserved', jsonb_build_array(
      'accounts for non-owners', 'leeo_staff', 'delivery_operator', 'stalls',
      'audit_logs', 'expenses', 'products_list', 'mnkde_network_edges'
    )
  );
end;
$$;
