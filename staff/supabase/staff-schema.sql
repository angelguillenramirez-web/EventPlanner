-- 643 (staff console): database setup — DRAFT FOR REVIEW. Do NOT run until approved.
-- Run later in Supabase > SQL Editor, after the customer schema (supabase/schema.sql). Idempotent.
--
-- Rules this draft follows:
--  * A "staff member" is an auth user that has a row in staff_members AND is active (AND signed in with 2FA once staff_security.require_2fa is switched on; it starts OFF).
--  * Every table has row-level security; the browser only ever holds the public (publishable) key.
--  * Customers (planners) never see staff tables, except: their own support threads / non-internal messages,
--    and published coupons/prices/templates through read-only rules or functions.
--  * Nothing here needs the service_role key in the browser. Staff invitations use an Edge Function (server side).

-- ───────── 0) Helpers ─────────
create table if not exists public.staff_members (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  name        text not null default '',
  role        text not null check (role in ('super_admin', 'support', 'designer')),
  active      boolean not null default true,
  title       text not null default '',
  avatar      text not null default '',
  presence    text not null default 'offline' check (presence in ('online','busy','meeting','lunch','break','away','offline')),
  presence_note text not null default '',
  presence_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id)
);

-- Second-factor switch. Starts OFF (simple email + password login). When the platform is deployed and staff have enrolled
-- an authenticator app, a super admin runs:  update public.staff_security set require_2fa = true;
-- From then on every staff policy below demands a 2FA-verified session (aal2). No other change is needed.
create table if not exists public.staff_security (
  id          boolean primary key default true check (id),   -- single row
  require_2fa boolean not null default false
);
insert into public.staff_security (id) values (true) on conflict do nothing;
alter table public.staff_security enable row level security;
drop policy if exists "security: staff read" on public.staff_security;
create policy "security: staff read" on public.staff_security for select to authenticated using (true);
-- No write policy: only run from the SQL Editor (or a future super-admin Edge Function).

create or replace function public.mfa_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' or not (select require_2fa from public.staff_security limit 1);
$$;

-- True when the caller is an ACTIVE staff member (and, once require_2fa is on, passed the second factor).
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.staff_members s where s.user_id = auth.uid() and s.active);
$$;
create or replace function public.staff_role() returns text language sql stable security definer set search_path = '' as $$
  select s.role from public.staff_members s where s.user_id = auth.uid() and s.active and public.mfa_ok();
$$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select public.staff_role() = 'super_admin';
$$;
revoke execute on function public.mfa_ok(), public.is_staff(), public.staff_role(), public.is_super_admin() from public, anon;
grant  execute on function public.mfa_ok(), public.is_staff(), public.staff_role(), public.is_super_admin() to authenticated;

-- ───────── 1) Staff members ─────────
alter table public.staff_members enable row level security;
drop policy if exists "staff: read all (staff)"      on public.staff_members;
drop policy if exists "staff: update own presence"   on public.staff_members;
drop policy if exists "staff: super admin manages"   on public.staff_members;
create policy "staff: read all (staff)" on public.staff_members for select to authenticated using (public.is_staff());
-- A member may edit their own profile fields, but never their own role or active flag (enforced by the trigger below).
create policy "staff: update own presence" on public.staff_members for update to authenticated using (public.is_staff() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "staff: super admin manages" on public.staff_members for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create or replace function public.guard_staff_self_edit() returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_super_admin() and (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email) then
    raise exception 'Only a super admin can change role, email or active status';
  end if;
  return new;
end $$;
drop trigger if exists staff_guard on public.staff_members;
create trigger staff_guard before update on public.staff_members for each row execute function public.guard_staff_self_edit();

-- ───────── 2) Support threads (customer ↔ staff) ─────────
-- The customer app creates a thread (chat or written request); staff reply. Internal notes are never visible to customers.
create table if not exists public.support_threads (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique,                                      -- SUP-000001 / DSN-… shown to the customer
  customer_id uuid not null references auth.users (id) on delete cascade,
  channel     text not null check (channel in ('chat', 'written')),
  subject     text not null default '',
  status      text not null default 'new' check (status in ('new','assigned','in_progress','waiting','done')),
  closed      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.support_threads (id) on delete cascade,
  author     uuid references auth.users (id),
  from_staff boolean not null default false,
  internal   boolean not null default false,                    -- staff-only note
  body       text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_thread on public.support_messages (thread_id, created_at);
alter table public.support_threads  enable row level security;
alter table public.support_messages enable row level security;
drop policy if exists "threads: customer own"  on public.support_threads;
drop policy if exists "threads: customer open" on public.support_threads;
drop policy if exists "threads: staff all"     on public.support_threads;
create policy "threads: customer own"  on public.support_threads for select to authenticated using (customer_id = auth.uid());
create policy "threads: customer open" on public.support_threads for insert to authenticated with check (customer_id = auth.uid() and status = 'new' and not closed);
create policy "threads: staff all"     on public.support_threads for all    to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "messages: customer read"  on public.support_messages;
drop policy if exists "messages: customer write" on public.support_messages;
drop policy if exists "messages: staff all"      on public.support_messages;
create policy "messages: customer read"  on public.support_messages for select to authenticated
  using (not internal and exists (select 1 from public.support_threads t where t.id = thread_id and t.customer_id = auth.uid()));
create policy "messages: customer write" on public.support_messages for insert to authenticated
  with check (not from_staff and not internal and author = auth.uid()
              and exists (select 1 from public.support_threads t where t.id = thread_id and t.customer_id = auth.uid() and not t.closed));
create policy "messages: staff all" on public.support_messages for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ───────── 3) Staff tasks (support / design / admin queue) ─────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique,
  kind         text not null check (kind in ('support','design','admin')),
  title        text not null,
  description  text not null default '',
  requester    text not null default '',
  customer_id  uuid references auth.users (id) on delete set null,
  thread_id    uuid references public.support_threads (id) on delete set null,
  priority     text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status       text not null default 'new' check (status in ('new','assigned','in_progress','waiting','done')),
  assignee_id  uuid references public.staff_members (user_id) on delete set null,
  channel      text not null default 'written' check (channel in ('chat','written')),
  origin_id    uuid references public.tasks (id),               -- support → design hand-off
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at  timestamptz
);
create table if not exists public.task_notes (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.tasks (id) on delete cascade,
  author    uuid references public.staff_members (user_id),
  body      text not null,
  internal  boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.task_events (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.tasks (id) on delete cascade,
  author    uuid references public.staff_members (user_id),
  text      text not null,
  created_at timestamptz not null default now()
);
alter table public.tasks       enable row level security;
alter table public.task_notes  enable row level security;
alter table public.task_events enable row level security;
-- Support sees support tasks, designers see design tasks, super admins see everything (same split the console uses today).
drop policy if exists "tasks: team read"  on public.tasks;
drop policy if exists "tasks: team write" on public.tasks;
create policy "tasks: team read" on public.tasks for select to authenticated
  using (public.is_staff() and (public.is_super_admin() or (kind = 'support' and public.staff_role() = 'support') or (kind = 'design' and public.staff_role() = 'designer') or assignee_id = auth.uid()));
create policy "tasks: team write" on public.tasks for all to authenticated
  using (public.is_staff() and (public.is_super_admin() or (kind = 'support' and public.staff_role() = 'support') or (kind = 'design' and public.staff_role() = 'designer') or assignee_id = auth.uid()))
  with check (public.is_staff());
drop policy if exists "task_notes: via task"  on public.task_notes;
drop policy if exists "task_events: via task" on public.task_events;
create policy "task_notes: via task"  on public.task_notes  for all to authenticated using (exists (select 1 from public.tasks t where t.id = task_id)) with check (public.is_staff());
create policy "task_events: via task" on public.task_events for all to authenticated using (exists (select 1 from public.tasks t where t.id = task_id)) with check (public.is_staff());
-- (A task a member cannot read hides its notes too: the subquery above is itself filtered by the tasks policy.)

-- ───────── 4) Prices, coupons (super admin only) ─────────
create table if not exists public.plan_prices (
  plan    text primary key check (plan in ('basic','planner','pro')),
  name    text not null,
  monthly numeric(10,2) not null check (monthly >= 0),
  yearly  numeric(10,2) not null check (yearly >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.coupons (
  code       text primary key check (code ~ '^[A-Z0-9_-]{3,24}$'),
  percent    int  not null check (percent between 1 and 100),
  note       text not null default '',
  active     boolean not null default true,
  expires    date,
  created_at timestamptz not null default now(),
  created_by uuid references public.staff_members (user_id),
  by_name    text not null default ''
);
alter table public.plan_prices enable row level security;
alter table public.coupons     enable row level security;
drop policy if exists "prices: public read"   on public.plan_prices;
drop policy if exists "prices: super admin"   on public.plan_prices;
drop policy if exists "coupons: staff read"   on public.coupons;
drop policy if exists "coupons: super admin"  on public.coupons;
create policy "prices: public read" on public.plan_prices for select to anon, authenticated using (true);
create policy "prices: super admin" on public.plan_prices for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy "coupons: staff read"  on public.coupons for select to authenticated using (public.is_staff());
create policy "coupons: super admin" on public.coupons for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
-- Customers never list coupons. They can only ask "is this code valid?" (returns the percent or null), so codes cannot be harvested.
create or replace function public.check_coupon(p_code text) returns int language sql stable security definer set search_path = '' as $$
  select c.percent from public.coupons c where c.code = upper(trim(p_code)) and c.active and (c.expires is null or c.expires >= current_date);
$$;
revoke execute on function public.check_coupon(text) from public, anon;
grant  execute on function public.check_coupon(text) to authenticated;

-- ───────── 5) Knowledge base, invitation templates ─────────
create table if not exists public.kb_articles (
  id text primary key default gen_random_uuid()::text,          -- text: the console's own ids (kb1, kb2…) carry over
  title text not null, category text not null default '', tags text[] not null default '{}', body text not null default '',
  updated_at timestamptz not null default now(), by_name text not null default ''
);
alter table public.kb_articles enable row level security;
drop policy if exists "kb: staff read"  on public.kb_articles;
drop policy if exists "kb: staff write" on public.kb_articles;
create policy "kb: staff read"  on public.kb_articles for select to authenticated using (public.is_staff());
create policy "kb: staff write" on public.kb_articles for all    to authenticated using (public.is_super_admin()) with check (public.is_super_admin());  -- only a super admin edits articles (same as the console)

create table if not exists public.invitation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null default '', status text not null default 'draft' check (status in ('draft','published')),
  html text not null default '', css text not null default '', full_page boolean not null default false,
  tags text[] not null default '{}', version int not null default 1,
  updated_at timestamptz not null default now(), updated_by uuid references public.staff_members (user_id)
);
alter table public.invitation_templates enable row level security;
drop policy if exists "templates: customers read published" on public.invitation_templates;
drop policy if exists "templates: designers write"          on public.invitation_templates;
create policy "templates: customers read published" on public.invitation_templates for select to authenticated using (status = 'published' or public.is_staff());
create policy "templates: designers write" on public.invitation_templates for all to authenticated
  using (public.staff_role() in ('designer','super_admin')) with check (public.staff_role() in ('designer','super_admin'));

-- ───────── 6) Audit log (append-only) ─────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references public.staff_members (user_id),
  by_name text not null default '',
  local_id text unique,                       -- the console's own entry id, so a retried upload never duplicates
  action text not null, target text not null default ''
);
alter table public.audit_log enable row level security;
drop policy if exists "audit: staff append"      on public.audit_log;
drop policy if exists "audit: super admin read"  on public.audit_log;
create policy "audit: staff append"     on public.audit_log for insert to authenticated with check (public.is_staff() and actor = auth.uid());
create policy "audit: super admin read" on public.audit_log for select to authenticated using (public.is_super_admin());
-- No update/delete policies: nobody can change or erase the log through the API.

-- ───────── 7) Staff read access to customers (never the whole auth table) ─────────
-- Staff see customers through this view: name, email, plan and status only. No passwords, no workspace data.
create or replace view public.staff_customers with (security_invoker = false) as
  select p.user_id, p.email, p.full_name, p.created_at, s.plan, s.cycle, s.status as sub_status, s.trial_end, s.current_period_end,
         u.last_sign_in_at, p.account_type, u.banned_until
  from public.profiles p
  left join public.subscriptions s on s.user_id = p.user_id
  left join auth.users u on u.id = p.user_id
  where public.is_staff() and not exists (select 1 from public.staff_members m where m.user_id = p.user_id);  -- staff accounts are not customers
revoke all on public.staff_customers from public, anon;
grant select on public.staff_customers to authenticated;

-- ───────── 8) Keep updated_at fresh ─────────
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
drop trigger if exists threads_touch on public.support_threads;
create trigger threads_touch before update on public.support_threads for each row execute function public.touch_updated_at();

-- NOT in this draft yet (next files): internal chat channels and messages, internal work tasks, API-key metadata,
-- website settings, customer actions (reset password / unblock / refund) which need server-side Edge Functions,
-- and the "invite staff" Edge Function that creates the auth user and the staff_members row.
