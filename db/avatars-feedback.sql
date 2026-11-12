-- Teacher avatars (public pictures, each teacher writes only into their own folder)
-- and site feedback (teachers write their own, only the admin reads everyone's).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_email text default (auth.jwt()->>'email'),
  user_name text not null default '' check (length(user_name) <= 120),
  likes text not null default '' check (length(likes) <= 2000),
  dislikes text not null default '' check (length(dislikes) <= 2000),
  ideas text not null default '' check (length(ideas) <= 2000),
  created_at timestamptz not null default now(),
  check (length(trim(likes)) + length(trim(dislikes)) + length(trim(ideas)) > 0)
);
alter table public.site_feedback enable row level security;
revoke all on public.site_feedback from public, anon, authenticated;
grant select, insert on public.site_feedback to authenticated;
drop policy if exists feedback_insert_own on public.site_feedback;
create policy feedback_insert_own on public.site_feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists feedback_read on public.site_feedback;
create policy feedback_read on public.site_feedback for select to authenticated
  using (user_id = (select auth.uid()) or coalesce((select auth.jwt()->>'email'), '') = 'admingotab.kz@gmail.com');
