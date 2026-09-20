begin;
alter table public.queue_records enable row level security;
alter table public.queue_number_counters enable row level security;
alter table public.ticket_transactions enable row level security;
alter table public.ticket_items enable row level security;
alter table public.unloading_sessions enable row level security;
alter table public.completed_unloading_records enable row level security;
revoke all privileges on table
  public.queue_records,
  public.queue_number_counters,
  public.ticket_transactions,
  public.ticket_items,
  public.unloading_sessions,
  public.completed_unloading_records
from anon;
grant select, insert, update, delete on table
  public.queue_records,
  public.queue_number_counters,
  public.ticket_transactions,
  public.ticket_items,
  public.unloading_sessions,
  public.completed_unloading_records
to authenticated;
drop policy if exists "dev queue records full access" on public.queue_records;
drop policy if exists "authenticated queue records full access" on public.queue_records;
create policy "authenticated queue records full access"
  on public.queue_records
  for all
  to authenticated
  using (true)
  with check (true);
drop policy if exists "dev queue number counters full access" on public.queue_number_counters;
drop policy if exists "authenticated queue number counters full access" on public.queue_number_counters;
create policy "authenticated queue number counters full access"
  on public.queue_number_counters
  for all
  to authenticated
  using (true)
  with check (true);
drop policy if exists "dev ticket transactions full access" on public.ticket_transactions;
drop policy if exists "authenticated ticket transactions full access" on public.ticket_transactions;
create policy "authenticated ticket transactions full access"
  on public.ticket_transactions
  for all
  to authenticated
  using (true)
  with check (true);
drop policy if exists "dev ticket items full access" on public.ticket_items;
drop policy if exists "authenticated ticket items full access" on public.ticket_items;
create policy "authenticated ticket items full access"
  on public.ticket_items
  for all
  to authenticated
  using (true)
  with check (true);
drop policy if exists "dev unloading sessions full access" on public.unloading_sessions;
drop policy if exists "authenticated unloading sessions full access" on public.unloading_sessions;
create policy "authenticated unloading sessions full access"
  on public.unloading_sessions
  for all
  to authenticated
  using (true)
  with check (true);
drop policy if exists "dev completed unloading records full access" on public.completed_unloading_records;
drop policy if exists "authenticated completed unloading records full access" on public.completed_unloading_records;
create policy "authenticated completed unloading records full access"
  on public.completed_unloading_records
  for all
  to authenticated
  using (true)
  with check (true);
commit;
