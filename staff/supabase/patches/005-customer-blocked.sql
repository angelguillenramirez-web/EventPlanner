-- Patch 005: run ONCE in Supabase > SQL Editor (shows blocked customers in 643). Safe to run again.
create or replace view public.staff_customers with (security_invoker = false) as
  select p.user_id, p.email, p.full_name, p.created_at, s.plan, s.cycle, s.status as sub_status, s.trial_end, s.current_period_end,
         u.last_sign_in_at, p.account_type, u.banned_until
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.user_id
  left join auth.users u on u.id = p.user_id
  where public.is_staff() and not exists (select 1 from public.staff_members m where m.user_id = p.user_id);
revoke all on public.staff_customers from public, anon;
grant select on public.staff_customers to authenticated;
