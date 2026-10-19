create or replace function public.get_completed_ticket_history(
  p_start_inclusive timestamptz,
  p_end_exclusive timestamptz,
  p_page integer,
  p_page_size integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_count bigint;
  v_total_pages integer;
  v_page integer;
  v_records jsonb;
begin
  if not public.is_eligible_delivery_user() then
    raise exception 'DELIVERY_ACCESS_FORBIDDEN: An active delivery account is required.'
      using errcode = '42501';
  end if;

  if (p_start_inclusive is null) <> (p_end_exclusive is null)
     or (p_start_inclusive is not null and p_end_exclusive <= p_start_inclusive) then
    raise exception 'INVALID_TICKET_HISTORY_RANGE' using errcode = '22023';
  end if;

  if p_page is null or p_page < 1
     or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'INVALID_TICKET_HISTORY_PAGE' using errcode = '22023';
  end if;

  with normalized as (
    select
      coalesce(nullif(ticket->>'id', ''), completed.id || ':' || expanded.ordinality::text) as id,
      coalesce(
        nullif(ticket->>'transactionId', ''),
        nullif(ticket->>'transaction_id', ''),
        nullif(ticket->>'ticketNo', ''),
        nullif(ticket->>'ticket_no', ''),
        'Ticket ' || expanded.ordinality::text
      ) as transaction_id,
      coalesce(
        nullif(ticket->>'vehicleType', ''),
        nullif(ticket->>'vehicle_type', ''),
        nullif(completed.vehicle_type, ''),
        'Unknown'
      ) as vehicle_type,
      coalesce(
        nullif(ticket->>'goodsType', ''),
        nullif(ticket->>'goods_type', ''),
        nullif(completed.product_category, ''),
        'N/A'
      ) as goods_type,
      case
        when pg_catalog.pg_input_is_valid(
          coalesce(ticket->>'totalAmount', ticket->>'total_amount', ticket->>'amount'),
          'pg_catalog.numeric'
        ) then greatest(
          coalesce(ticket->>'totalAmount', ticket->>'total_amount', ticket->>'amount')::numeric,
          0::numeric
        )
        else 0::numeric
      end as total_amount,
      case
        when pg_catalog.pg_input_is_valid(
          coalesce(ticket->>'issuedAtISO', ticket->>'issued_at'),
          'pg_catalog.timestamptz'
        ) then coalesce(ticket->>'issuedAtISO', ticket->>'issued_at')::timestamptz
        else completed.marked_done_at
      end as issued_at
    from public.completed_unloading_records completed
    cross join lateral pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(completed.tickets) = 'array'
        then completed.tickets else '[]'::jsonb end
    ) with ordinality as expanded(ticket, ordinality)
  ), filtered as (
    select *
    from normalized
    where p_start_inclusive is null
       or (issued_at >= p_start_inclusive and issued_at < p_end_exclusive)
  )
  select count(*) into v_total_count from filtered;

  v_total_pages := greatest(1, ceil(v_total_count::numeric / p_page_size)::integer);
  v_page := least(p_page, v_total_pages);

  with normalized as (
    select
      coalesce(nullif(ticket->>'id', ''), completed.id || ':' || expanded.ordinality::text) as id,
      coalesce(
        nullif(ticket->>'transactionId', ''),
        nullif(ticket->>'transaction_id', ''),
        nullif(ticket->>'ticketNo', ''),
        nullif(ticket->>'ticket_no', ''),
        'Ticket ' || expanded.ordinality::text
      ) as transaction_id,
      coalesce(
        nullif(ticket->>'vehicleType', ''),
        nullif(ticket->>'vehicle_type', ''),
        nullif(completed.vehicle_type, ''),
        'Unknown'
      ) as vehicle_type,
      coalesce(
        nullif(ticket->>'goodsType', ''),
        nullif(ticket->>'goods_type', ''),
        nullif(completed.product_category, ''),
        'N/A'
      ) as goods_type,
      case
        when pg_catalog.pg_input_is_valid(
          coalesce(ticket->>'totalAmount', ticket->>'total_amount', ticket->>'amount'),
          'pg_catalog.numeric'
        ) then greatest(
          coalesce(ticket->>'totalAmount', ticket->>'total_amount', ticket->>'amount')::numeric,
          0::numeric
        )
        else 0::numeric
      end as total_amount,
      case
        when pg_catalog.pg_input_is_valid(
          coalesce(ticket->>'issuedAtISO', ticket->>'issued_at'),
          'pg_catalog.timestamptz'
        ) then coalesce(ticket->>'issuedAtISO', ticket->>'issued_at')::timestamptz
        else completed.marked_done_at
      end as issued_at
    from public.completed_unloading_records completed
    cross join lateral pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(completed.tickets) = 'array'
        then completed.tickets else '[]'::jsonb end
    ) with ordinality as expanded(ticket, ordinality)
  ), filtered as (
    select *
    from normalized
    where p_start_inclusive is null
       or (issued_at >= p_start_inclusive and issued_at < p_end_exclusive)
  ), page_rows as (
    select *
    from filtered
    order by issued_at desc, id desc
    limit p_page_size
    offset (v_page - 1) * p_page_size
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', id,
        'transaction_id', transaction_id,
        'vehicle_type', vehicle_type,
        'goods_type', goods_type,
        'total_amount', total_amount,
        'issued_at', issued_at
      ) order by issued_at desc, id desc
    ),
    '[]'::jsonb
  ) into v_records
  from page_rows;

  return pg_catalog.jsonb_build_object(
    'records', v_records,
    'total_count', v_total_count,
    'page', v_page,
    'page_size', p_page_size,
    'total_pages', v_total_pages
  );
end;
$$;
revoke all on function public.get_completed_ticket_history(timestamptz, timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_completed_ticket_history(timestamptz, timestamptz, integer, integer)
  to authenticated;
