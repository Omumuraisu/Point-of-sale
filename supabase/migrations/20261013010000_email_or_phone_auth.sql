-- Normalize uniqueness at the same boundaries used by the authentication flow.
create unique index if not exists accounts_email_normalized_key
  on public.accounts (lower(btrim(email)))
  where nullif(btrim(email), '') is not null;
create unique index if not exists accounts_phone_normalized_key
  on public.accounts ((regexp_replace(phone_number, '[^0-9]', '', 'g')))
  where nullif(btrim(phone_number), '') is not null;
create or replace function public.find_auth_user_by_identifier(
  p_channel text,
  p_identifier text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_channel = 'email' then
    select auth_user.id
      into v_user_id
    from auth.users auth_user
    where lower(btrim(coalesce(auth_user.email, ''))) = lower(btrim(p_identifier))
    order by auth_user.created_at
    limit 1;
  elsif p_channel = 'phone' then
    select auth_user.id
      into v_user_id
    from auth.users auth_user
    where regexp_replace(coalesce(auth_user.phone, ''), '[^0-9]', '', 'g') =
          regexp_replace(coalesce(p_identifier, ''), '[^0-9]', '', 'g')
    order by auth_user.created_at
    limit 1;
  else
    raise exception 'Invalid authentication channel';
  end if;

  return v_user_id;
end;
$$;
revoke all on function public.find_auth_user_by_identifier(text, text)
  from public, anon, authenticated;
grant execute on function public.find_auth_user_by_identifier(text, text)
  to service_role;
drop function if exists public.get_my_delivery_profile();
create function public.get_my_delivery_profile()
returns table (
  account_id bigint,
  auth_user_id uuid,
  user_type text,
  operator_id bigint,
  first_name text,
  middle_initial text,
  last_name text,
  phone_number text,
  email text,
  profile_picture_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.account_id,
    account.auth_user_id,
    account.user_type::text,
    delivery_profile.operator_id,
    delivery_profile.first_name,
    delivery_profile.middle_initial,
    delivery_profile.last_name,
    account.phone_number,
    account.email,
    delivery_profile.profile_picture_url
  from public.accounts account
  join public.delivery_operator delivery_profile
    on delivery_profile.account_id = account.account_id
  where account.auth_user_id = auth.uid()
    and account.status::text = 'active'
    and coalesce(account.is_verified, false) = true
    and account.user_type::text in ('delivery_operator', 'developer')
    and delivery_profile.archived_at is null
  limit 1;
$$;
revoke all on function public.get_my_delivery_profile() from public, anon;
grant execute on function public.get_my_delivery_profile() to authenticated;
