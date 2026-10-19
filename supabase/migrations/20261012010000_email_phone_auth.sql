-- This unique index intentionally fails if duplicate non-empty account emails
-- exist. Resolve the reported duplicates before applying this migration.
create unique index if not exists accounts_email_ci_unique
  on public.accounts (lower(btrim(email)))
  where email is not null and btrim(email) <> '';

alter table public.account_verification_requests
  add column if not exists channel text;

update public.account_verification_requests
set channel = 'sms'
where channel is null;

alter table public.account_verification_requests
  alter column channel set default 'sms',
  alter column channel set not null;

alter table public.account_verification_requests
  drop constraint if exists account_verification_requests_channel_check;

alter table public.account_verification_requests
  add constraint account_verification_requests_channel_check
  check (channel in ('email', 'sms'));

create or replace function public.find_auth_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(p_email, '')))
    and btrim(coalesce(p_email, '')) <> ''
  order by created_at
  limit 1;
$$;

revoke all on function public.find_auth_user_by_email(text)
  from public, anon, authenticated;
grant execute on function public.find_auth_user_by_email(text)
  to service_role;
