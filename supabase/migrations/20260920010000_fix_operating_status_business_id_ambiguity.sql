begin;

create or replace function public.set_business_operating_status(p_business_id bigint, p_is_open boolean)
returns table (
    business_id bigint,
    stall_number text,
    is_open boolean,
    updated_at timestamptz,
    updated_by_account_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_status public.business_operating_status%rowtype;
    v_account_id bigint;
    v_is_developer boolean;
begin
    select exists (
        select 1
        from public.accounts a
        join public.business b on b.business_id = p_business_id
        where a.auth_user_id = auth.uid()
          and lower(coalesce(a.status::text, '')) = 'active'
          and coalesce(a.is_verified, false) = true
          and lower(a.user_type::text) = 'developer'
    )
    into v_is_developer;

    if auth.uid() is null
       or (
           not public.can_manage_business_operating_status(p_business_id)
           and not coalesce(v_is_developer, false)
       ) then
        raise exception 'OPERATING_STATUS_FORBIDDEN: Only the owner, approved personnel, or a developer can change this status.' using errcode = '42501';
    end if;

    v_account_id := public.current_pos_account_id();

    insert into public.business_operating_status (business_id, stall_number, is_open)
    select b.business_id, coalesce(b.stall_number, b.stall_no), false
    from public.business b
    where b.business_id = p_business_id
    on conflict do nothing;

    select * into v_status
    from public.business_operating_status s
    where s.business_id = p_business_id
    for update;

    if not found then
        raise exception 'OPERATING_STATUS_NOT_FOUND: Business status was not found.' using errcode = 'P0002';
    end if;

    if v_status.is_open is distinct from p_is_open then
        update public.business_operating_status s
        set is_open = p_is_open,
            updated_at = now(),
            updated_by_account_id = v_account_id
        where s.business_id = p_business_id
        returning * into v_status;
    end if;

    return query
    select v_status.business_id, v_status.stall_number, v_status.is_open,
           v_status.updated_at, v_status.updated_by_account_id;
end;
$$;

revoke all on function public.set_business_operating_status(bigint, boolean) from public;
grant execute on function public.set_business_operating_status(bigint, boolean) to authenticated;

commit;
