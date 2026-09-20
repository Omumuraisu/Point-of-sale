create table if not exists public.account_verification_requests (
  id uuid primary key default gen_random_uuid(),
  account_id bigint not null references public.accounts(account_id) on delete cascade,
  purpose text not null check (purpose in ('activation', 'recovery')),
  requested_at timestamptz not null default now(),
  status text not null default 'reserved'
    check (status in ('reserved', 'sent', 'failed'))
);
create index if not exists account_verification_requests_account_idx
  on public.account_verification_requests(account_id, requested_at desc);
create index if not exists account_verification_requests_requested_idx
  on public.account_verification_requests(requested_at desc);
alter table public.account_verification_requests enable row level security;
revoke all on table public.account_verification_requests from anon, authenticated;
create or replace function public.claim_account_verification(
  p_account_id bigint,
  p_purpose text
)
returns table (
  allowed boolean,
  request_id uuid,
  retry_after_seconds integer,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_last_requested_at timestamptz;
  v_account_daily_count integer;
  v_global_hourly_count integer;
  v_request_id uuid;
begin
  if p_purpose not in ('activation', 'recovery') then
    raise exception 'Invalid verification purpose';
  end if;

  perform pg_advisory_xact_lock(73378102);

  select max(requested_at)
  into v_last_requested_at
  from public.account_verification_requests
  where account_id = p_account_id;

  if v_last_requested_at is not null
     and v_last_requested_at > v_now - interval '60 seconds' then
    return query select
      false,
      null::uuid,
      greatest(
        1,
        ceil(extract(epoch from (v_last_requested_at + interval '60 seconds' - v_now)))::integer
      ),
      'cooldown'::text;
    return;
  end if;

  select count(*)::integer
  into v_account_daily_count
  from public.account_verification_requests
  where account_id = p_account_id
    and requested_at >= date_trunc('day', v_now);

  if v_account_daily_count >= 5 then
    return query select
      false,
      null::uuid,
      greatest(
        1,
        ceil(extract(epoch from (date_trunc('day', v_now) + interval '1 day' - v_now)))::integer
      ),
      'account_daily_limit'::text;
    return;
  end if;

  select count(*)::integer
  into v_global_hourly_count
  from public.account_verification_requests
  where requested_at >= v_now - interval '1 hour';

  if v_global_hourly_count >= 30 then
    return query select
      false,
      null::uuid,
      3600,
      'global_hourly_limit'::text;
    return;
  end if;

  insert into public.account_verification_requests (account_id, purpose)
  values (p_account_id, p_purpose)
  returning id into v_request_id;

  return query select true, v_request_id, 60, null::text;
end;
$$;
revoke all on function public.claim_account_verification(bigint, text)
  from public, anon, authenticated;
grant execute on function public.claim_account_verification(bigint, text)
  to service_role;
create or replace function public.find_auth_user_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') =
        regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
  order by created_at
  limit 1;
$$;
revoke all on function public.find_auth_user_by_phone(text)
  from public, anon, authenticated;
grant execute on function public.find_auth_user_by_phone(text)
  to service_role;
create or replace function public.get_my_delivery_profile()
returns table (
  account_id bigint,
  auth_user_id uuid,
  user_type text,
  operator_id bigint,
  first_name text,
  middle_initial text,
  last_name text,
  phone_number text,
  profile_picture_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    accounts.account_id,
    accounts.auth_user_id,
    accounts.user_type::text,
    delivery_operator.operator_id,
    delivery_operator.first_name,
    delivery_operator.middle_initial,
    delivery_operator.last_name,
    accounts.phone_number,
    delivery_operator.profile_picture_url
  from public.accounts
  join public.delivery_operator
    on delivery_operator.account_id = accounts.account_id
  where accounts.auth_user_id = auth.uid()
    and accounts.status::text = 'active'
    and accounts.is_verified = true
    and accounts.user_type::text in ('delivery_operator', 'developer')
    and delivery_operator.archived_at is null
  limit 1;
$$;
revoke all on function public.get_my_delivery_profile() from public, anon;
grant execute on function public.get_my_delivery_profile() to authenticated;
