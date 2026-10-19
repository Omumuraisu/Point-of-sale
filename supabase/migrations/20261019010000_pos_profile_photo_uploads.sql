begin;

alter table public.business_owner
  add column if not exists profile_picture_url text;

alter table public.vendor
  add column if not exists profile_picture_url text;

create or replace function public.update_my_pos_profile(
  p_first_name text,
  p_last_name text,
  p_profile_picture_url text default null
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

  if nullif(btrim(p_first_name), '') is null
     or nullif(btrim(p_last_name), '') is null then
    raise exception 'First name and last name are required.';
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
    set first_name = btrim(p_first_name),
        middle_initial = 'NA',
        last_name = btrim(p_last_name),
        profile_picture_url = case
          when p_profile_picture_url is null then profile_picture_url
          else nullif(btrim(p_profile_picture_url), '')
        end
    where account_id = v_account_id
      and archived_at is null;
  else
    update public.vendor
    set first_name = btrim(p_first_name),
        middle_initial = 'NA',
        last_name = btrim(p_last_name),
        profile_picture_url = case
          when p_profile_picture_url is null then profile_picture_url
          else nullif(btrim(p_profile_picture_url), '')
        end
    where account_id = v_account_id
      and is_approved = true;
  end if;

  if not found then
    raise exception 'An active POS profile was not found.';
  end if;

  update public.accounts
  set username = concat_ws(' ', btrim(p_first_name), btrim(p_last_name))
  where account_id = v_account_id;
end;
$$;

revoke all on function public.update_my_pos_profile(text, text, text) from public, anon;
alter function public.update_my_pos_profile(text, text, text) owner to postgres;
grant execute on function public.update_my_pos_profile(text, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists pos_upload_own_profile_photo on storage.objects;
create policy pos_upload_own_profile_photo
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
  );

drop policy if exists pos_read_own_profile_photo on storage.objects;
create policy pos_read_own_profile_photo
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
  );

drop policy if exists pos_update_own_profile_photo on storage.objects;
create policy pos_update_own_profile_photo
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
  )
  with check (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
  );

drop policy if exists pos_delete_own_profile_photo on storage.objects;
create policy pos_delete_own_profile_photo
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
  );

commit;
