-- Deploy before the client that calls these RPCs. The legacy single-number RPC is retained.
create or replace function public.reserve_queue_number_block(
  p_service_date date,
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_block_size integer default 100
)
returns table(start_number integer, end_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seed integer;
  v_end integer;
begin
  if not public.is_eligible_delivery_user() then
    raise exception 'DELIVERY_ACCESS_FORBIDDEN: An active delivery account is required.' using errcode = '42501';
  end if;
  if p_service_date is null or p_day_start is null or p_day_end is null
     or p_day_end <= p_day_start or p_day_end > p_day_start + interval '26 hours'
     or p_block_size < 1 or p_block_size > 1000 then
    raise exception 'INVALID_QUEUE_BLOCK_REQUEST' using errcode = '22023';
  end if;

  select greatest(
    coalesce((select max(queue_number) from public.queue_records where date = p_service_date), 0),
    coalesce((select max(queue_number) from public.unloading_sessions
      where started_at >= p_day_start and started_at < p_day_end), 0),
    coalesce((select max(regexp_replace(vehicle_number, '[^0-9]', '', 'g')::integer)
      from public.ticket_transactions where issued_at >= p_day_start and issued_at < p_day_end
      and regexp_replace(vehicle_number, '[^0-9]', '', 'g') <> ''), 0)
  ) into v_seed;

  insert into public.queue_number_counters(service_date, last_queue_number)
  values (p_service_date, v_seed + p_block_size)
  on conflict (service_date) do update set
    last_queue_number = greatest(public.queue_number_counters.last_queue_number, v_seed) + p_block_size,
    updated_at = now()
  returning last_queue_number into v_end;

  return query select v_end - p_block_size + 1, v_end;
end;
$$;
create or replace function public.sync_ticket_issue(
  p_ticket jsonb,
  p_unloading_session jsonb default null,
  p_queue_record_id_to_delete text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_synced_at timestamptz := now();
begin
  if not public.is_eligible_delivery_user() then
    raise exception 'DELIVERY_ACCESS_FORBIDDEN: An active delivery account is required.' using errcode = '42501';
  end if;
  if not public.delivery_assignment_is_allowed(nullif(p_ticket->>'issued_by_operator_id', '')::bigint) then
    raise exception 'DELIVERY_ASSIGNMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_unloading_session is not null and not public.delivery_assignment_is_allowed(
    nullif(p_unloading_session->>'assigned_operator_id', '')::bigint
  ) then
    raise exception 'DELIVERY_ASSIGNMENT_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.ticket_transactions(
    id, queue_record_id, transaction_id, ticket_no, vehicle_number, vehicle_type,
    goods_type, unloading_time, suggested_unloading_time, total_amount, issued_at,
    issued_at_display, issued_by_operator_id, issued_by_operator_name, synced, synced_at
  ) values (
    p_ticket->>'id', nullif(p_ticket->>'queue_record_id', ''), p_ticket->>'transaction_id',
    p_ticket->>'ticket_no', p_ticket->>'vehicle_number', p_ticket->>'vehicle_type',
    p_ticket->>'goods_type', p_ticket->>'unloading_time', p_ticket->>'suggested_unloading_time',
    (p_ticket->>'total_amount')::numeric, (p_ticket->>'issued_at')::timestamptz,
    p_ticket->>'issued_at_display', nullif(p_ticket->>'issued_by_operator_id', '')::bigint,
    nullif(p_ticket->>'issued_by_operator_name', ''), true, v_synced_at
  ) on conflict (id) do update set synced = true, synced_at = excluded.synced_at
  returning synced_at into v_synced_at;

  for v_item in select value from jsonb_array_elements(coalesce(p_ticket->'items', '[]'::jsonb)) loop
    insert into public.ticket_items(id, ticket_transaction_id, goods_type, qty, unit, fee, fee_rate)
    values (v_item->>'id', p_ticket->>'id', v_item->>'goods_type', (v_item->>'qty')::integer,
      v_item->>'unit', (v_item->>'fee')::numeric, (v_item->>'fee_rate')::numeric)
    on conflict (id) do nothing;
  end loop;

  if p_unloading_session is not null then
    insert into public.unloading_sessions(
      id, queue_record_id, queue_number, vehicle_number, vehicle_type, product_category,
      arrived_at, started_at, estimated_minutes, estimated_label,
      assigned_operator_id, assigned_operator_name
    ) values (
      p_unloading_session->>'id', p_unloading_session->>'queue_record_id',
      (p_unloading_session->>'queue_number')::integer, p_unloading_session->>'vehicle_number',
      p_unloading_session->>'vehicle_type', p_unloading_session->>'product_category',
      nullif(p_unloading_session->>'arrived_at', '')::timestamptz,
      (p_unloading_session->>'started_at')::timestamptz,
      (p_unloading_session->>'estimated_minutes')::integer, p_unloading_session->>'estimated_label',
      nullif(p_unloading_session->>'assigned_operator_id', '')::bigint,
      nullif(p_unloading_session->>'assigned_operator_name', '')
    ) on conflict (id) do nothing;
  end if;

  if p_queue_record_id_to_delete is not null then
    delete from public.queue_records where id = p_queue_record_id_to_delete;
  end if;
  return v_synced_at;
end;
$$;
create or replace function public.sync_completed_unloading(
  p_session_id text,
  p_completed_record jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_eligible_delivery_user() then
    raise exception 'DELIVERY_ACCESS_FORBIDDEN: An active delivery account is required.' using errcode = '42501';
  end if;
  if not public.delivery_assignment_is_allowed(
    nullif(p_completed_record->>'assigned_operator_id', '')::bigint
  ) then
    raise exception 'DELIVERY_ASSIGNMENT_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.completed_unloading_records(
    id, unloading_session_id, queue_record_id, queue_number, vehicle_number, vehicle_type,
    product_category, arrived_at, started_at, marked_done_at, docked_duration_seconds,
    docked_duration_label, assigned_operator_id, assigned_operator_name, ticket_count,
    ticket_total_amount, tickets
  ) values (
    p_completed_record->>'id', p_completed_record->>'unloading_session_id',
    p_completed_record->>'queue_record_id', (p_completed_record->>'queue_number')::integer,
    p_completed_record->>'vehicle_number', p_completed_record->>'vehicle_type',
    p_completed_record->>'product_category', nullif(p_completed_record->>'arrived_at', '')::timestamptz,
    (p_completed_record->>'started_at')::timestamptz,
    (p_completed_record->>'marked_done_at')::timestamptz,
    (p_completed_record->>'docked_duration_seconds')::integer,
    p_completed_record->>'docked_duration_label',
    nullif(p_completed_record->>'assigned_operator_id', '')::bigint,
    nullif(p_completed_record->>'assigned_operator_name', ''),
    (p_completed_record->>'ticket_count')::integer,
    (p_completed_record->>'ticket_total_amount')::numeric,
    coalesce(p_completed_record->'tickets', '[]'::jsonb)
  ) on conflict (id) do nothing;
  delete from public.unloading_sessions where id = p_session_id;
end;
$$;
revoke all on function public.reserve_queue_number_block(date, timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.sync_ticket_issue(jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.sync_completed_unloading(text, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_queue_number_block(date, timestamptz, timestamptz, integer) to authenticated, service_role;
grant execute on function public.sync_ticket_issue(jsonb, jsonb, text) to authenticated, service_role;
grant execute on function public.sync_completed_unloading(text, jsonb) to authenticated, service_role;
