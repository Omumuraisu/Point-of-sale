begin;

create or replace function public.get_pos_billing_balances(p_business_id bigint)
returns setof public.v_monthly_bill_balances
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null or not exists (
        select 1
        from public.accounts a
        left join public.business_owner bo on bo.account_id = a.account_id
        left join public.vendor v on v.account_id = a.account_id
        join public.business b on b.business_id = p_business_id
        where a.auth_user_id = auth.uid()
          and lower(coalesce(a.status::text, '')) = 'active'
          and coalesce(a.is_verified, false) = true
          and (
              (bo.business_owner_id = b.business_owner_id and bo.archived_at is null)
              or (
                  v.business_owner_id = b.business_owner_id
                  and coalesce(v.is_approved, false) = true
              )
              or lower(a.user_type::text) = 'developer'
          )
    ) then
        raise exception 'BILLING_FORBIDDEN: You are not authorized to view billing for this business.'
            using errcode = '42501';
    end if;

    return query
    select bill.*
    from public.v_monthly_bill_balances bill
    where bill.business_id = p_business_id
    order by bill.billing_month desc, bill.monthly_bill_id desc;
end;
$$;

revoke all on function public.get_pos_billing_balances(bigint) from public, anon;
grant execute on function public.get_pos_billing_balances(bigint) to authenticated;

commit;
