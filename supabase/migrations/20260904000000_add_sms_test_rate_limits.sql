create table if not exists public.sms_test_requests (
  id uuid primary key default gen_random_uuid(),
  account_id bigint not null references public.accounts(account_id) on delete cascade,
  requested_at timestamptz not null default now(),
  provider_message_id text,
  provider_status text not null default 'reserved'
);
create index if not exists sms_test_requests_account_requested_idx
  on public.sms_test_requests(account_id, requested_at desc);
create index if not exists sms_test_requests_requested_idx
  on public.sms_test_requests(requested_at desc);
alter table public.sms_test_requests enable row level security;
create or replace function public.claim_sms_test_send(p_account_id bigint)
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
  v_global_daily_count integer;
  v_request_id uuid;
begin
  -- Serialize debug reservations so parallel requests cannot bypass a limit.
  perform pg_advisory_xact_lock(73378101);

  select max(requested_at)
  into v_last_requested_at
  from public.sms_test_requests
  where account_id = p_account_id;

  if v_last_requested_at is not null
     and v_last_requested_at > v_now - interval '5 minutes' then
    return query select
      false,
      null::uuid,
      greatest(
        1,
        ceil(extract(epoch from (v_last_requested_at + interval '5 minutes' - v_now)))::integer
      ),
      'cooldown'::text;
    return;
  end if;

  select count(*)::integer
  into v_account_daily_count
  from public.sms_test_requests
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
  into v_global_daily_count
  from public.sms_test_requests
  where requested_at >= date_trunc('day', v_now);

  if v_global_daily_count >= 20 then
    return query select
      false,
      null::uuid,
      greatest(
        1,
        ceil(extract(epoch from (date_trunc('day', v_now) + interval '1 day' - v_now)))::integer
      ),
      'global_daily_limit'::text;
    return;
  end if;

  insert into public.sms_test_requests (account_id)
  values (p_account_id)
  returning id into v_request_id;

  return query select true, v_request_id, 300, null::text;
end;
$$;
revoke all on function public.claim_sms_test_send(bigint) from public, anon, authenticated;
grant execute on function public.claim_sms_test_send(bigint) to service_role;
