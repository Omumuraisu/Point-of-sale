-- Align delivery-app profile photos with the shared admin profile-photo bucket.
-- Existing profile-pictures objects and URLs remain readable for compatibility.

alter table public.delivery_operator
  add column if not exists profile_picture_url text;
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
create or replace function public.update_my_delivery_profile_picture(
  p_profile_picture_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator_id bigint;
begin
  if auth.uid() is null then
    raise exception 'An authenticated delivery session is required.';
  end if;

  v_operator_id := public.current_delivery_operator_id();
  if v_operator_id is null then
    raise exception 'An active delivery profile was not found.';
  end if;

  update public.delivery_operator
  set profile_picture_url = nullif(btrim(p_profile_picture_url), '')
  where operator_id = v_operator_id
    and archived_at is null;

  if not found then
    raise exception 'An active delivery profile was not found.';
  end if;
end;
$$;
revoke all on function public.update_my_delivery_profile_picture(text) from public, anon;
alter function public.update_my_delivery_profile_picture(text) owner to postgres;
grant execute on function public.update_my_delivery_profile_picture(text) to authenticated;
drop policy if exists "delivery users upload own profile photo" on storage.objects;
create policy "delivery users upload own profile photo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
    and public.is_eligible_delivery_user()
  );
drop policy if exists "delivery users read own profile photo" on storage.objects;
create policy "delivery users read own profile photo"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
    and public.is_eligible_delivery_user()
  );
drop policy if exists "delivery users update own profile photo" on storage.objects;
create policy "delivery users update own profile photo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
    and public.is_eligible_delivery_user()
  )
  with check (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
    and public.is_eligible_delivery_user()
  );
drop policy if exists "delivery users delete own profile photo" on storage.objects;
create policy "delivery users delete own profile photo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and name = ((select auth.uid())::text || '/avatar')
    and public.is_eligible_delivery_user()
  );
