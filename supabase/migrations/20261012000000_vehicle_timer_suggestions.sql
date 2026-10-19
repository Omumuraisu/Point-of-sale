create or replace function public.get_vehicle_timer_suggestions()
returns table (
  vehicle_type text,
  average_minutes integer,
  completed_vehicles bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_eligible_delivery_user() then
    raise exception 'DELIVERY_ACCESS_FORBIDDEN: An active delivery account is required.'
      using errcode = '42501';
  end if;

  return query
  select
    lower(btrim(completed.vehicle_type)) as vehicle_type,
    round(avg(completed.docked_duration_seconds)::numeric / 60)::integer as average_minutes,
    count(*)::bigint as completed_vehicles
  from public.completed_unloading_records completed
  where lower(btrim(completed.vehicle_type)) in (
      'tricycle',
      'jeep',
      'van',
      'truck',
      'pickup truck'
    )
    and completed.docked_duration_seconds >= 0
  group by lower(btrim(completed.vehicle_type))
  order by array_position(
    array['tricycle', 'jeep', 'van', 'truck', 'pickup truck']::text[],
    lower(btrim(completed.vehicle_type))
  );
end;
$$;
revoke all on function public.get_vehicle_timer_suggestions()
  from public, anon, authenticated;
grant execute on function public.get_vehicle_timer_suggestions() to authenticated;
