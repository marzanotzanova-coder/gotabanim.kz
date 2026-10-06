-- 1. Profiles table
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  phone text,
  email text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "select_own" on public.profiles for select using (auth.uid() = id);
create policy "insert_own" on public.profiles for insert with check (auth.uid() = id);

-- 2. Auto-create profile when user registers
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Function for admin to read all users
create or replace function public.get_all_profiles()
returns table(id uuid, name text, phone text, email text, is_admin boolean, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, name, phone, email, is_admin, created_at
  from public.profiles
  order by created_at desc;
$$;

-- 4. Materials table
create table public.materials (
  id uuid default gen_random_uuid() primary key,
  grade integer not null,
  subject text not null,
  lesson_num integer not null,
  title text not null,
  ppt_url text,
  qmj_url text,
  video_url text,
  created_at timestamptz default now(),
  unique(grade, subject, lesson_num)
);

alter table public.materials enable row level security;

create policy "materials_read" on public.materials
  for select to authenticated using (true);
