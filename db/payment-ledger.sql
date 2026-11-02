create table public.teacher_payments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 linked_user_ids uuid[] not null default '{}', teacher_name text not null, teacher_email text,
 subject text not null check(subject in ('math','informatics')), amount integer not null default 4990 check(amount>0),
 paid_at timestamptz, expires_at timestamptz, date_estimated boolean not null default false,
 refunded_amount integer not null default 0 check(refunded_amount>=0 and refunded_amount<=amount),
 refunded_at timestamptz, note text not null default '', created_at timestamptz not null default now()
);
alter table public.teacher_payments enable row level security;
revoke all on public.teacher_payments from anon,authenticated;
grant select on public.teacher_payments to authenticated;
create policy payments_admin_read on public.teacher_payments for select to authenticated using ((select auth.jwt()->>'email')='admingotab.kz@gmail.com');
create schema if not exists private;
create or replace function private.capture_teacher_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.is_paid is distinct from old.is_paid or new.paid_until is distinct from old.paid_until or new.is_paid_informatics is distinct from old.is_paid_informatics or new.paid_informatics_until is distinct from old.paid_informatics_until) and auth.uid() is not null and coalesce(auth.jwt()->>'email','') <> 'admingotab.kz@gmail.com' then raise exception 'Admin only'; end if;
 if new.is_paid and new.paid_until is not null and (not coalesce(old.is_paid,false) or new.paid_until is distinct from old.paid_until) then
 insert into public.teacher_payments(user_id,teacher_name,teacher_email,subject,paid_at,expires_at) values(new.id,coalesce(new.name,new.email,''),new.email,'math',now(),new.paid_until); end if;
 if new.is_paid_informatics and new.paid_informatics_until is not null and (not coalesce(old.is_paid_informatics,false) or new.paid_informatics_until is distinct from old.paid_informatics_until) then
 insert into public.teacher_payments(user_id,teacher_name,teacher_email,subject,paid_at,expires_at) values(new.id,coalesce(new.name,new.email,''),new.email,'informatics',now(),new.paid_informatics_until); end if;
 return new;
end $$;
revoke all on function private.capture_teacher_payment() from public,anon,authenticated;
create trigger teacher_payment_capture after update on public.profiles for each row execute function private.capture_teacher_payment();
create or replace function public.record_teacher_refund(payment_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'email','') <> 'admingotab.kz@gmail.com' then raise exception 'Admin only'; end if;
 update public.teacher_payments set refunded_amount=amount, refunded_at=now() where id=payment_id and refunded_amount=0;
 if not found then raise exception 'Payment not found or already refunded'; end if;
end $$;
revoke all on function public.record_teacher_refund(uuid) from public,anon;
grant execute on function public.record_teacher_refund(uuid) to authenticated;
-- Approval retries must not create a second payment.
create or replace function public.approve_payment_request(req_id uuid, uid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'email','')<>'admingotab.kz@gmail.com' then raise exception 'Admin only'; end if;
 update public.payment_requests set status='approved' where id=req_id and user_id=uid and status='pending' and coalesce(subject,'math')='math';
 if not found then return; end if;
 update public.profiles set is_paid=true,paid_until=now()+interval '30 days' where id=uid;
end $$;
create or replace function public.approve_informatics_payment(req_id uuid, uid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'email','')<>'admingotab.kz@gmail.com' then raise exception 'Admin only'; end if;
 update public.payment_requests set status='approved' where id=req_id and user_id=uid and status='pending' and subject='informatics';
 if not found then return; end if;
 update public.profiles set is_paid_informatics=true,paid_informatics_until=now()+interval '30 days' where id=uid;
end $$;
revoke all on function public.approve_payment_request(uuid,uuid),public.approve_informatics_payment(uuid,uuid) from public,anon;
grant execute on function public.approve_payment_request(uuid,uuid),public.approve_informatics_payment(uuid,uuid) to authenticated;
