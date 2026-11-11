-- Subscription plans: 1 month 4 990 ₸, 6 months 25 000 ₸, 1 year 45 000 ₸.
-- The teacher picks a plan on the payment card; the admin opens access for the plan that was actually paid.

alter table public.payment_requests add column if not exists plan_months integer not null default 1;
alter table public.payment_requests drop constraint if exists payment_requests_plan_months_check;
alter table public.payment_requests add constraint payment_requests_plan_months_check check (plan_months in (1, 6, 12));

-- Open (or extend) access for a plan and record the plan's price in the payment ledger
create or replace function public.grant_subscription(uid uuid, subj text, months integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  amt integer := case months when 1 then 4990 when 6 then 25000 when 12 then 45000 end;
  s text := case when subj = 'informatics' then 'informatics' else 'math' end;
  span interval := case when months = 1 then interval '30 days' else make_interval(months => months) end;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'email', '') <> 'admingotab.kz@gmail.com' then raise exception 'Admin only'; end if;
  if amt is null then raise exception 'Unknown plan'; end if;
  insert into public.profiles(id) values (uid) on conflict do nothing;
  if s = 'informatics' then
    update public.profiles set is_paid_informatics = true, paid_informatics_until = greatest(now(), coalesce(paid_informatics_until, now())) + span where id = uid;
  else
    update public.profiles set is_paid = true, paid_until = greatest(now(), coalesce(paid_until, now())) + span where id = uid;
  end if;
  -- the ledger trigger has just written this payment with the default 4 990 ₸
  update public.teacher_payments set amount = amt where user_id = uid and subject = s and created_at = now();
end $$;

-- Approve a teacher's payment request with the plan the admin confirmed
create or replace function public.approve_payment_plan(req_id uuid, uid uuid, months integer) returns void
language plpgsql security definer set search_path = '' as $$
declare s text;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'email', '') <> 'admingotab.kz@gmail.com' then raise exception 'Admin only'; end if;
  update public.payment_requests set status = 'approved', plan_months = months
    where id = req_id and user_id = uid and status = 'pending' returning coalesce(subject, 'math') into s;
  if not found then return; end if;
  perform public.grant_subscription(uid, s, months);
end $$;

drop function if exists public.get_payment_requests();
create function public.get_payment_requests()
returns table(id uuid, user_id uuid, user_email text, user_name text, created_at timestamptz, status text, subject text, plan_months integer)
language sql security definer set search_path = public as $$
  select id, user_id, user_email, user_name, created_at, status, coalesce(subject, 'math'), plan_months
  from public.payment_requests
  where coalesce(auth.jwt()->>'email', '') = 'admingotab.kz@gmail.com'  -- only the admin sees everyone's requests
  order by created_at desc;
$$;

revoke all on function public.grant_subscription(uuid, text, integer) from public, anon;
revoke all on function public.approve_payment_plan(uuid, uuid, integer) from public, anon;
revoke all on function public.get_payment_requests() from public, anon;
grant execute on function public.grant_subscription(uuid, text, integer) to authenticated;
grant execute on function public.approve_payment_plan(uuid, uuid, integer) to authenticated;
grant execute on function public.get_payment_requests() to authenticated;
