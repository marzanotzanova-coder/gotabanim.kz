create table public.animation_library (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 300),
 aspect text not null check(aspect in ('9:16','16:9')),
 storage_path text not null unique check(storage_path ~ '^(9x16|16x9)/[a-f0-9-]+\.(mp4|webm|mov)$'),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=524288000),
 created_at timestamptz not null default now()
);
alter table public.animation_library enable row level security;
revoke all on public.animation_library from anon,authenticated;
grant select,insert on public.animation_library to authenticated;
create policy animation_read on public.animation_library for select to authenticated using (
 (select auth.jwt()->>'email')='admingotab.kz@gmail.com' or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and not coalesce(p.is_banned,false) and ((p.is_paid and p.paid_until>now()) or (p.is_paid_informatics and p.paid_informatics_until>now())))
);
create policy animation_admin_insert on public.animation_library for insert to authenticated with check ((select auth.jwt()->>'email')='admingotab.kz@gmail.com');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('animation-library','animation-library',false,524288000,array['video/mp4','video/webm','video/quicktime']);
create policy animation_file_read on storage.objects for select to authenticated using(bucket_id='animation-library' and ((select auth.jwt()->>'email')='admingotab.kz@gmail.com' or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and not coalesce(p.is_banned,false) and ((p.is_paid and p.paid_until>now()) or (p.is_paid_informatics and p.paid_informatics_until>now())))));
create policy animation_file_insert on storage.objects for insert to authenticated with check(bucket_id='animation-library' and (select auth.jwt()->>'email')='admingotab.kz@gmail.com');
create policy animation_file_cleanup on storage.objects for delete to authenticated using(bucket_id='animation-library' and (select auth.jwt()->>'email')='admingotab.kz@gmail.com');
