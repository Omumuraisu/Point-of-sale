begin;
create or replace function public.current_delivery_operator_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select delivery_profile.operator_id
  from public.accounts account
  join public.delivery_operator delivery_profile
    on delivery_profile.account_id = account.account_id
  where account.auth_user_id = auth.uid()
    and account.status::text = 'active'
    and coalesce(account.is_verified, false) = true
    and account.user_type::text in ('delivery_operator', 'developer')
    and delivery_profile.archived_at is null
  limit 1
$$;
create or replace function public.current_delivery_user_is_developer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts account
    join public.delivery_operator delivery_profile
      on delivery_profile.account_id = account.account_id
    where account.auth_user_id = auth.uid()
      and account.status::text = 'active'
      and coalesce(account.is_verified, false) = true
      and account.user_type::text = 'developer'
      and delivery_profile.archived_at is null
  )
$$;
create or replace function public.is_eligible_delivery_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_delivery_operator_id() is not null
$$;
create or replace function public.can_manage_delivery_row(p_operator_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_eligible_delivery_user()
    and (
      p_operator_id = public.current_delivery_operator_id()
      or public.current_delivery_user_is_developer()
    )
$$;
create or replace function public.delivery_assignment_is_allowed(p_operator_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_operator_id is not null
    and (
      p_operator_id = public.current_delivery_operator_id()
      or (
        public.current_delivery_user_is_developer()
        and exists (
          select 1
          from public.delivery_operator delivery_profile
          join public.accounts target_account
            on target_account.account_id = delivery_profile.account_id
          where delivery_profile.operator_id = p_operator_id
            and delivery_profile.archived_at is null
            and target_account.status::text = 'active'
            and coalesce(target_account.is_verified, false) = true
            and target_account.user_type::text in ('delivery_operator', 'developer')
        )
      )
    )
$$;
create or replace function public.can_manage_ticket_transaction(p_ticket_transaction_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ticket_transactions ticket
    where ticket.id = p_ticket_transaction_id
      and public.can_manage_delivery_row(ticket.issued_by_operator_id)
  )
$$;
revoke all on function public.current_delivery_operator_id() from public, anon, authenticated;
revoke all on function public.current_delivery_user_is_developer() from public, anon, authenticated;
revoke all on function public.is_eligible_delivery_user() from public, anon, authenticated;
revoke all on function public.can_manage_delivery_row(bigint) from public, anon, authenticated;
revoke all on function public.delivery_assignment_is_allowed(bigint) from public, anon, authenticated;
revoke all on function public.can_manage_ticket_transaction(text) from public, anon, authenticated;
grant execute on function public.current_delivery_operator_id() to authenticated;
grant execute on function public.current_delivery_user_is_developer() to authenticated;
grant execute on function public.is_eligible_delivery_user() to authenticated;
grant execute on function public.can_manage_delivery_row(bigint) to authenticated;
grant execute on function public.delivery_assignment_is_allowed(bigint) to authenticated;
grant execute on function public.can_manage_ticket_transaction(text) to authenticated;
create or replace function public.reserve_queue_number(
  p_service_date date,
  p_day_start timestamptz,
  p_day_end timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seed_number integer;
  v_reserved_number integer;
begin
  if auth.role() <> 'service_role' and not public.is_eligible_delivery_user() then
    raise exception 'DELIVERY_ACCESS_FORBIDDEN: An active delivery account is required.'
      using errcode = '42501';
  end if;

  if p_service_date is null
     or p_day_start is null
     or p_day_end is null
     or p_day_end <= p_day_start
     or p_day_end > p_day_start + interval '26 hours' then
    raise exception 'INVALID_QUEUE_DAY_RANGE: A valid service day range is required.'
      using errcode = '22023';
  end if;

  select greatest(
    coalesce((
      select max(queue_number)
      from public.queue_records
      where date = p_service_date
    ), 0),
    coalesce((
      select max(queue_number)
      from public.unloading_sessions
      where started_at >= p_day_start
        and started_at < p_day_end
    ), 0),
    coalesce((
      select max(regexp_replace(vehicle_number, '[^0-9]', '', 'g')::integer)
      from public.ticket_transactions
      where issued_at >= p_day_start
        and issued_at < p_day_end
        and regexp_replace(vehicle_number, '[^0-9]', '', 'g') <> ''
    ), 0)
  ) into v_seed_number;

  insert into public.queue_number_counters (service_date, last_queue_number)
  values (p_service_date, v_seed_number + 1)
  on conflict (service_date) do update
    set last_queue_number = greatest(
        public.queue_number_counters.last_queue_number,
        v_seed_number
      ) + 1,
      updated_at = now()
  returning last_queue_number into v_reserved_number;

  return v_reserved_number;
end;
$$;
revoke all on function public.reserve_queue_number(date, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_queue_number(date, timestamptz, timestamptz)
  to authenticated, service_role;
alter table public.queue_records enable row level security;
alter table public.queue_number_counters enable row level security;
alter table public.ticket_transactions enable row level security;
alter table public.ticket_items enable row level security;
alter table public.unloading_sessions enable row level security;
alter table public.completed_unloading_records enable row level security;
alter table public.delivery_operator enable row level security;
revoke all on table
  public.queue_records,
  public.queue_number_counters,
  public.ticket_transactions,
  public.ticket_items,
  public.unloading_sessions,
  public.completed_unloading_records,
  public.delivery_operator
from public, anon, authenticated;
grant select, insert, update, delete on table public.queue_records to authenticated;
grant select, insert, update on table public.ticket_transactions to authenticated;
grant select, insert, update on table public.ticket_items to authenticated;
grant select, insert, update, delete on table public.unloading_sessions to authenticated;
grant select, insert, update on table public.completed_unloading_records to authenticated;
grant select on table public.delivery_operator to authenticated;
grant update (profile_picture_url) on table public.delivery_operator to authenticated;
drop policy if exists "dev queue records full access" on public.queue_records;
drop policy if exists "authenticated queue records full access" on public.queue_records;
drop policy if exists "delivery users read queue records" on public.queue_records;
drop policy if exists "operators insert assigned queue records" on public.queue_records;
drop policy if exists "operators update assigned queue records" on public.queue_records;
drop policy if exists "operators delete assigned queue records" on public.queue_records;
create policy "delivery users read queue records"
  on public.queue_records for select to authenticated
  using (public.is_eligible_delivery_user());
create policy "operators insert assigned queue records"
  on public.queue_records for insert to authenticated
  with check (public.delivery_assignment_is_allowed(assigned_operator_id));
create policy "operators update assigned queue records"
  on public.queue_records for update to authenticated
  using (public.can_manage_delivery_row(assigned_operator_id))
  with check (public.delivery_assignment_is_allowed(assigned_operator_id));
create policy "operators delete assigned queue records"
  on public.queue_records for delete to authenticated
  using (public.can_manage_delivery_row(assigned_operator_id));
drop policy if exists "dev queue number counters full access" on public.queue_number_counters;
drop policy if exists "authenticated queue number counters full access" on public.queue_number_counters;
drop policy if exists "dev ticket transactions full access" on public.ticket_transactions;
drop policy if exists "authenticated ticket transactions full access" on public.ticket_transactions;
drop policy if exists "delivery users read ticket transactions" on public.ticket_transactions;
drop policy if exists "operators insert ticket transactions" on public.ticket_transactions;
drop policy if exists "operators update ticket transactions" on public.ticket_transactions;
create policy "delivery users read ticket transactions"
  on public.ticket_transactions for select to authenticated
  using (public.is_eligible_delivery_user());
create policy "operators insert ticket transactions"
  on public.ticket_transactions for insert to authenticated
  with check (public.delivery_assignment_is_allowed(issued_by_operator_id));
create policy "operators update ticket transactions"
  on public.ticket_transactions for update to authenticated
  using (public.can_manage_delivery_row(issued_by_operator_id))
  with check (public.delivery_assignment_is_allowed(issued_by_operator_id));
drop policy if exists "dev ticket items full access" on public.ticket_items;
drop policy if exists "authenticated ticket items full access" on public.ticket_items;
drop policy if exists "delivery users read ticket items" on public.ticket_items;
drop policy if exists "operators insert ticket items" on public.ticket_items;
drop policy if exists "operators update ticket items" on public.ticket_items;
create policy "delivery users read ticket items"
  on public.ticket_items for select to authenticated
  using (public.is_eligible_delivery_user());
create policy "operators insert ticket items"
  on public.ticket_items for insert to authenticated
  with check (public.can_manage_ticket_transaction(ticket_transaction_id));
create policy "operators update ticket items"
  on public.ticket_items for update to authenticated
  using (public.can_manage_ticket_transaction(ticket_transaction_id))
  with check (public.can_manage_ticket_transaction(ticket_transaction_id));
drop policy if exists "dev unloading sessions full access" on public.unloading_sessions;
drop policy if exists "authenticated unloading sessions full access" on public.unloading_sessions;
drop policy if exists "delivery users read unloading sessions" on public.unloading_sessions;
drop policy if exists "operators insert assigned unloading sessions" on public.unloading_sessions;
drop policy if exists "operators update assigned unloading sessions" on public.unloading_sessions;
drop policy if exists "operators delete assigned unloading sessions" on public.unloading_sessions;
create policy "delivery users read unloading sessions"
  on public.unloading_sessions for select to authenticated
  using (public.is_eligible_delivery_user());
create policy "operators insert assigned unloading sessions"
  on public.unloading_sessions for insert to authenticated
  with check (public.delivery_assignment_is_allowed(assigned_operator_id));
create policy "operators update assigned unloading sessions"
  on public.unloading_sessions for update to authenticated
  using (public.can_manage_delivery_row(assigned_operator_id))
  with check (public.delivery_assignment_is_allowed(assigned_operator_id));
create policy "operators delete assigned unloading sessions"
  on public.unloading_sessions for delete to authenticated
  using (public.can_manage_delivery_row(assigned_operator_id));
drop policy if exists "dev completed unloading records full access" on public.completed_unloading_records;
drop policy if exists "authenticated completed unloading records full access" on public.completed_unloading_records;
drop policy if exists "operators read assigned completed unloadings" on public.completed_unloading_records;
drop policy if exists "operators insert assigned completed unloadings" on public.completed_unloading_records;
drop policy if exists "operators update assigned completed unloadings" on public.completed_unloading_records;
create policy "operators read assigned completed unloadings"
  on public.completed_unloading_records for select to authenticated
  using (public.can_manage_delivery_row(assigned_operator_id));
create policy "operators insert assigned completed unloadings"
  on public.completed_unloading_records for insert to authenticated
  with check (public.delivery_assignment_is_allowed(assigned_operator_id));
create policy "operators update assigned completed unloadings"
  on public.completed_unloading_records for update to authenticated
  using (public.can_manage_delivery_row(assigned_operator_id))
  with check (public.delivery_assignment_is_allowed(assigned_operator_id));
drop policy if exists "dev delivery operators full access" on public.delivery_operator;
drop policy if exists "delivery operators read own profile" on public.delivery_operator;
drop policy if exists "delivery operators update own profile" on public.delivery_operator;
create policy "delivery operators read own profile"
  on public.delivery_operator for select to authenticated
  using (operator_id = public.current_delivery_operator_id());
create policy "delivery operators update own profile"
  on public.delivery_operator for update to authenticated
  using (operator_id = public.current_delivery_operator_id())
  with check (operator_id = public.current_delivery_operator_id());
drop policy if exists "profile pictures public read" on storage.objects;
drop policy if exists "profile pictures anon upload" on storage.objects;
drop policy if exists "profile pictures anon update" on storage.objects;
drop policy if exists "profile pictures owner upload" on storage.objects;
drop policy if exists "profile pictures owner update" on storage.objects;
drop policy if exists "profile pictures owner delete" on storage.objects;
create policy "profile pictures public read"
  on storage.objects for select to public
  using (bucket_id = 'profile-pictures');
create policy "profile pictures owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = 'delivery-operators'
    and (storage.foldername(name))[2] = public.current_delivery_operator_id()::text
  );
create policy "profile pictures owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = 'delivery-operators'
    and (storage.foldername(name))[2] = public.current_delivery_operator_id()::text
  )
  with check (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = 'delivery-operators'
    and (storage.foldername(name))[2] = public.current_delivery_operator_id()::text
  );
create policy "profile pictures owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (storage.foldername(name))[1] = 'delivery-operators'
    and (storage.foldername(name))[2] = public.current_delivery_operator_id()::text
  );
do $$
begin
  if to_regclass('public.audit_logs') is not null then
    execute 'alter table public.audit_logs enable row level security';
    execute 'revoke all on table public.audit_logs from public, anon, authenticated';
    execute 'drop policy if exists "dev audit logs insert access" on public.audit_logs';
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
