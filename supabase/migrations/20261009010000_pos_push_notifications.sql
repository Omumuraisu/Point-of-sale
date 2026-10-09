begin;

create table if not exists public.pos_push_tokens (
    push_token_id bigint generated always as identity primary key,
    account_id bigint not null references public.accounts(account_id) on delete cascade,
    expo_push_token text not null unique,
    platform text not null check (platform in ('android')),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_registered_at timestamptz not null default now(),
    last_error text
);

create index if not exists pos_push_tokens_account_active_idx
    on public.pos_push_tokens(account_id, active);

create table if not exists public.push_notification_deliveries (
    delivery_id bigint generated always as identity primary key,
    notification_id bigint not null references public.notifications(notification_id) on delete cascade,
    push_token_id bigint references public.pos_push_tokens(push_token_id) on delete set null,
    expo_push_token text not null,
    status text not null default 'queued' check (status in ('queued', 'sent', 'error')),
    expo_ticket_id text,
    error_code text,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (notification_id, expo_push_token)
);

create index if not exists push_notification_deliveries_notification_idx
    on public.push_notification_deliveries(notification_id, created_at desc);

alter table public.pos_push_tokens enable row level security;
alter table public.push_notification_deliveries enable row level security;

revoke all on public.pos_push_tokens from anon, authenticated;
revoke all on public.push_notification_deliveries from anon, authenticated;

create or replace function public.register_pos_push_token(
    p_expo_push_token text,
    p_platform text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_account_id bigint;
    v_push_token_id bigint;
    v_token text := btrim(coalesce(p_expo_push_token, ''));
    v_platform text := lower(btrim(coalesce(p_platform, '')));
begin
    v_account_id := public.current_pos_account_id();
    if auth.uid() is null or v_account_id is null then
        raise exception 'PUSH_TOKEN_FORBIDDEN: An active verified account is required.' using errcode = '42501';
    end if;
    if char_length(v_token) not between 20 and 500 then
        raise exception 'PUSH_TOKEN_INVALID: A valid Expo push token is required.' using errcode = '22023';
    end if;
    if v_platform <> 'android' then
        raise exception 'PUSH_PLATFORM_INVALID: Only Android push registration is supported.' using errcode = '22023';
    end if;

    insert into public.pos_push_tokens (
        account_id, expo_push_token, platform, active, updated_at, last_registered_at, last_error
    ) values (
        v_account_id, v_token, v_platform, true, now(), now(), null
    )
    on conflict (expo_push_token) do update
    set account_id = excluded.account_id,
        platform = excluded.platform,
        active = true,
        updated_at = now(),
        last_registered_at = now(),
        last_error = null
    returning push_token_id into v_push_token_id;

    return v_push_token_id;
end;
$$;

create or replace function public.unregister_pos_push_token(p_expo_push_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_account_id bigint;
    v_updated_count integer;
begin
    v_account_id := public.current_pos_account_id();
    if auth.uid() is null or v_account_id is null then
        return false;
    end if;

    update public.pos_push_tokens
    set active = false,
        updated_at = now()
    where account_id = v_account_id
      and expo_push_token = btrim(coalesce(p_expo_push_token, ''))
      and active = true;
    get diagnostics v_updated_count = row_count;
    return v_updated_count > 0;
end;
$$;

revoke all on function public.register_pos_push_token(text, text) from public, anon;
revoke all on function public.unregister_pos_push_token(text) from public, anon;
grant execute on function public.register_pos_push_token(text, text) to authenticated;
grant execute on function public.unregister_pos_push_token(text) to authenticated;

commit;
