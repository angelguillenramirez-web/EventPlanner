-- Patch 007: shared support / design / admin task queue. Run ONCE in Supabase > SQL Editor. Safe to run again.
-- Replaces the draft tasks tables from staff-schema.sql (they were never used). Each task is one row; the whole task
-- (notes, history, details) lives in `data`; the columns beside it exist so the database can decide who may see a task.
drop table if exists public.task_notes;
drop table if exists public.task_events;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'data') = false then
    drop table if exists public.tasks cascade;
  end if;
end $$;
create table if not exists public.tasks (
  id         text primary key,                                   -- SUP-000012 (from a customer) or SUP-K3QX9A (made by staff)
  kind       text not null check (kind in ('support','design','admin')),
  status     text not null,
  assignee   text not null default '',                           -- staff user id (text)
  customer   text not null default '',
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
drop policy if exists "tasks: team read"   on public.tasks;
drop policy if exists "tasks: team write"  on public.tasks;
drop policy if exists "tasks: create"      on public.tasks;
drop policy if exists "tasks: update"      on public.tasks;
drop policy if exists "tasks: delete"      on public.tasks;
-- Support sees support tasks, designers see design tasks, super admins see everything; anyone also sees tasks assigned to them.
create or replace function public.can_see_task(k text, a text) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() and (public.is_super_admin() or (k = 'support' and public.staff_role() = 'support') or (k = 'design' and public.staff_role() = 'designer') or a = auth.uid()::text);
$$;
revoke execute on function public.can_see_task(text, text) from public, anon;
grant  execute on function public.can_see_task(text, text) to authenticated;
create policy "tasks: team read"  on public.tasks for select to authenticated using (public.can_see_task(kind, assignee));
create policy "tasks: create"     on public.tasks for insert to authenticated with check (public.is_staff());      -- e.g. support hands a request to design
create policy "tasks: update"     on public.tasks for update to authenticated using (public.can_see_task(kind, assignee)) with check (public.is_staff());
create policy "tasks: delete"     on public.tasks for delete to authenticated using (public.is_super_admin());
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
