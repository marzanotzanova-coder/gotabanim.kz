create table public.teacher_cabinet (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('class','recent','saved')),
  grade smallint not null check (grade between 5 and 11),
  subject text not null check (subject in ('math','algebra','geometry','informatics','math_emn','algebra_emn','geometry_emn')),
  lesson_num integer not null check (lesson_num >= 0),
  title text not null default '',
  folder text not null default '' check (length(folder) <= 80),
  updated_at timestamptz not null default now(),
  primary key (user_id,kind,grade,subject,lesson_num),
  check ((kind='class') = (lesson_num=0))
);
alter table public.teacher_cabinet enable row level security;
revoke all on public.teacher_cabinet from public, anon, authenticated;
grant select,insert,update,delete on public.teacher_cabinet to authenticated;
create policy own_cabinet on public.teacher_cabinet for all to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
