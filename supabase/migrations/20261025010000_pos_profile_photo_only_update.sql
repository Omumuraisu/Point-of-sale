begin;

create or replace function public.update_my_pos_profile_photo(
  p_profile_picture_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id bigint;
  v_user_type text;
begin
  if auth.uid() is null then
    raise exception 'An authenticated session is required.';
  end if;

  select account.account_id, lower(btrim(account.user_type::text))
  into v_account_id, v_user_type
  from public.accounts as account
  where account.auth_user_id = auth.uid()
    and lower(btrim(account.status::text)) = 'active'
    and account.is_verified = true
    and lower(btrim(account.user_type::text)) in ('business_owner', 'vendor')
  limit 1;

  if v_account_id is null then
    raise exception 'An active POS profile was not found.';
  end if;

  if v_user_type = 'business_owner' then
    update public.business_owner
    set profile_picture_url = nullif(btrim(p_profile_picture_url), '')
    where account_id = v_account_id
      and archived_at is null;
  else
    update public.vendor
    set profile_picture_url = nullif(btrim(p_profile_picture_url), '')
    where account_id = v_account_id
      and is_approved = true;
  end if;

  if not found then
    raise exception 'An active POS profile was not found.';
  end if;
end;
$$;

revoke all on function public.update_my_pos_profile_photo(text) from public, anon;
alter function public.update_my_pos_profile_photo(text) owner to postgres;
grant execute on function public.update_my_pos_profile_photo(text) to authenticated;

commit;

notify pgrst, 'reload schema';
