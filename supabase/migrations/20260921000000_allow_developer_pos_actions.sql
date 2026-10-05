begin;

create or replace function public.can_manage_stall_catalog(p_stall_number text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.accounts a
        left join public.business_owner bo on bo.account_id = a.account_id
        left join public.vendor v on v.account_id = a.account_id
        join public.business b on coalesce(b.stall_number, b.stall_no) = p_stall_number
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
    )
$$;

create or replace function public.can_manage_business_operating_status(p_business_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
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
    )
$$;

create or replace function public.record_open_stall_sale(
    p_business_id bigint,
    p_client_order_key text,
    p_paid_amount numeric,
    p_rows jsonb
)
returns table (
    order_id bigint,
    completed_at timestamptz,
    total_due_php numeric,
    paid_amount_php numeric,
    change_amount_php numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_account_id bigint;
    v_stall_id public.business.stall_id%type;
    v_stall_number text;
    v_is_open boolean;
    v_total_due numeric;
    v_completed_at timestamptz := now();
    v_order public.sales_order%rowtype;
begin
    if auth.uid() is null or not public.can_manage_business_operating_status(p_business_id) then
        raise exception 'SALE_FORBIDDEN: Only the owner, approved personnel, or a developer can record sales.' using errcode = '42501';
    end if;

    if p_client_order_key is null or char_length(btrim(p_client_order_key)) not between 8 and 200 then
        raise exception 'SALE_ORDER_KEY_INVALID: A valid checkout key is required.' using errcode = '22023';
    end if;

    if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
        raise exception 'SALE_ROWS_REQUIRED: At least one sale row is required.' using errcode = '22023';
    end if;

    v_account_id := public.current_pos_account_id();
    perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || btrim(p_client_order_key), 0));

    select * into v_order
    from public.sales_order o
    where o.account_id = v_account_id
      and o.client_order_key = btrim(p_client_order_key)
    for update;

    if found then
        if v_order.business_id <> p_business_id then
            raise exception 'SALE_ORDER_KEY_MISMATCH: This checkout key belongs to another business.' using errcode = '23514';
        end if;

        return query
        select v_order.order_id, v_order.completed_at, v_order.total_due_php,
               v_order.paid_amount_php, v_order.change_amount_php;
        return;
    end if;

    select coalesce(b.stall_id, st.stall_id), coalesce(b.stall_number, b.stall_no)
    into v_stall_id, v_stall_number
    from public.business b
    left join public.stalls st on st.stall_number = coalesce(b.stall_number, b.stall_no)
    where b.business_id = p_business_id;

    if not found or v_stall_id is null then
        raise exception 'SALE_BUSINESS_REQUIRED: The selected business has no valid stall.' using errcode = '23503';
    end if;

    select s.is_open
    into v_is_open
    from public.business_operating_status s
    where s.business_id = p_business_id
    for share;

    if not found or not coalesce(v_is_open, false) then
        raise exception 'STALL_CLOSED: Open the stall before starting a sale.' using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from jsonb_to_recordset(p_rows) as r(
            category text, product text, quantity_sold_kg numeric,
            sold_quantity numeric, unit_price_php numeric
        )
        where coalesce(btrim(r.category), '') = ''
           or coalesce(btrim(r.product), '') = ''
           or r.quantity_sold_kg is null or r.quantity_sold_kg <= 0 or r.quantity_sold_kg >= 'Infinity'::numeric
           or r.unit_price_php is null or r.unit_price_php < 0 or r.unit_price_php >= 'Infinity'::numeric
    ) then
        raise exception 'SALE_ROW_INVALID: Product, category, positive quantity, and valid price are required.' using errcode = '22023';
    end if;

    select sum(r.quantity_sold_kg * r.unit_price_php)
    into v_total_due
    from jsonb_to_recordset(p_rows) as r(quantity_sold_kg numeric, unit_price_php numeric);

    if v_total_due is null or v_total_due <= 0 or v_total_due >= 'Infinity'::numeric then
        raise exception 'SALE_TOTAL_INVALID: The calculated sale total must be positive.' using errcode = '22023';
    end if;

    if p_paid_amount is null or p_paid_amount < v_total_due or p_paid_amount >= 'Infinity'::numeric then
        raise exception 'SALE_PAYMENT_INVALID: The paid amount must cover the calculated total.' using errcode = '22023';
    end if;

    insert into public.sales_order (
        client_order_key, business_id, stall_id, stall_number, account_id,
        username, total_due_php, paid_amount_php, completed_at
    ) values (
        btrim(p_client_order_key), p_business_id, v_stall_id, v_stall_number, v_account_id,
        coalesce((p_rows -> 0 ->> 'username'), ''), v_total_due, p_paid_amount, v_completed_at
    ) returning * into v_order;

    insert into public.sales_transaction (
        order_id, business_id, stall_id, stall_number, account_id, username, category, product,
        product_listing_id, catalog_product_id, quantity_sold_kg, sold_quantity,
        sold_unit, unit_price_php, transaction_date, sync_date
    )
    select
        v_order.order_id,
        p_business_id,
        v_stall_id,
        v_stall_number,
        v_account_id,
        coalesce(r.username, ''),
        r.category,
        r.product,
        r.product_listing_id,
        r.catalog_product_id,
        r.quantity_sold_kg,
        coalesce(r.sold_quantity, r.quantity_sold_kg),
        r.sold_unit,
        r.unit_price_php,
        v_completed_at,
        v_completed_at
    from jsonb_to_recordset(p_rows) as r(
        username text,
        category text,
        product text,
        product_listing_id text,
        catalog_product_id uuid,
        quantity_sold_kg numeric,
        sold_quantity numeric,
        sold_unit text,
        unit_price_php numeric
    );

    return query
    select v_order.order_id, v_order.completed_at, v_order.total_due_php,
           v_order.paid_amount_php, v_order.change_amount_php;
end;
$$;

revoke all on function public.can_manage_stall_catalog(text) from public;
revoke all on function public.record_open_stall_sale(bigint, text, numeric, jsonb) from public;
grant execute on function public.record_open_stall_sale(bigint, text, numeric, jsonb) to authenticated;

commit;
