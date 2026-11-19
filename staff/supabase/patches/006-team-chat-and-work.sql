-- Patch 006: internal team chat + work task manager. Run ONCE in Supabase > SQL Editor (after staff-schema.sql). Safe to run again.
-- Privacy is enforced by the database: a chat is visible only to its members (a DM only to the two people), a work task only to
-- its owner and assignees (a super admin sees all work tasks, but NOT other people's chats).

-- ── Work tasks ──
create table if not exists public.work_tasks (
  id         text primary key,
  owner      uuid not null references public.staff_members (user_id) on delete cascade,
  assignees  uuid[] not null default '{}',
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.work_statuses (id text primary key, name text not null, color text not null default '', pos int not null default 0);
create table if not exists public.work_tags (tag text primary key);
alter table public.work_tasks    enable row level security;
alter table public.work_statuses enable row level security;
alter table public.work_tags     enable row level security;
drop policy if exists "work: read"   on public.work_tasks;
drop policy if exists "work: insert" on public.work_tasks;
drop policy if exists "work: update" on public.work_tasks;
drop policy if exists "work: delete" on public.work_tasks;
create policy "work: read"   on public.work_tasks for select to authenticated using (public.is_staff() and (public.is_super_admin() or owner = auth.uid() or auth.uid() = any (assignees)));
create policy "work: insert" on public.work_tasks for insert to authenticated with check (public.is_staff() and owner = auth.uid());
create policy "work: update" on public.work_tasks for update to authenticated using (public.is_staff() and (public.is_super_admin() or owner = auth.uid() or auth.uid() = any (assignees))) with check (public.is_staff());
create policy "work: delete" on public.work_tasks for delete to authenticated using (public.is_staff() and (public.is_super_admin() or owner = auth.uid()));
drop policy if exists "work statuses: staff" on public.work_statuses;
drop policy if exists "work tags: staff"     on public.work_tags;
create policy "work statuses: staff" on public.work_statuses for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "work tags: staff"     on public.work_tags     for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Team chat ──
create table if not exists public.chat_channels (
  id      text primary key,
  kind    text not null check (kind in ('group', 'dm')),
  members uuid[] not null default '{}',
  data    jsonb not null default '{}'::jsonb          -- name, topic, created by / at
);
create table if not exists public.chat_messages (
  id         text primary key,
  ch         text not null references public.chat_channels (id) on delete cascade,
  at         timestamptz not null default now(),
  data       jsonb not null,                           -- text, sticker, image, reply, reactions, edited / deleted / pinned
  updated_at timestamptz not null default now()
);
create index if not exists chat_messages_ch_at on public.chat_messages (ch, at);
create index if not exists chat_messages_upd   on public.chat_messages (updated_at);
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists "chat channels: members" on public.chat_channels;
drop policy if exists "chat channels: create"  on public.chat_channels;
drop policy if exists "chat channels: update"  on public.chat_channels;
create policy "chat channels: members" on public.chat_channels for select to authenticated using (public.is_staff() and auth.uid() = any (members));
create policy "chat channels: create"  on public.chat_channels for insert to authenticated with check (public.is_staff() and auth.uid() = any (members));
create policy "chat channels: update"  on public.chat_channels for update to authenticated using (public.is_staff() and auth.uid() = any (members)) with check (public.is_staff());  -- also lets a member leave a group
drop policy if exists "chat messages: read"   on public.chat_messages;
drop policy if exists "chat messages: write"  on public.chat_messages;
drop policy if exists "chat messages: edit"   on public.chat_messages;
create policy "chat messages: read"  on public.chat_messages for select to authenticated using (public.is_staff() and exists (select 1 from public.chat_channels c where c.id = ch and auth.uid() = any (c.members)));
create policy "chat messages: write" on public.chat_messages for insert to authenticated with check (public.is_staff() and exists (select 1 from public.chat_channels c where c.id = ch and auth.uid() = any (c.members)));
create policy "chat messages: edit"  on public.chat_messages for update to authenticated using (public.is_staff() and exists (select 1 from public.chat_channels c where c.id = ch and auth.uid() = any (c.members))) with check (public.is_staff());
drop trigger if exists chat_messages_touch on public.chat_messages;
create trigger chat_messages_touch before update on public.chat_messages for each row execute function public.touch_updated_at();

-- #general: everyone at 643. Created now for the current staff; every new staff member is added automatically.
insert into public.chat_channels (id, kind, members, data)
select 'general', 'group', coalesce(array_agg(user_id), '{}'), jsonb_build_object('name', 'general', 'topic', 'Everyone at 643', 'by', (select user_id::text from public.staff_members where role = 'super_admin' order by created_at limit 1), 'at', (extract(epoch from now()) * 1000)::bigint)
from public.staff_members on conflict (id) do nothing;
create or replace function public.join_general() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_channels set members = array_append(members, new.user_id) where id = 'general' and not (new.user_id = any (members));
  return new;
end $$;
revoke execute on function public.join_general() from public, anon, authenticated;
drop trigger if exists staff_join_general on public.staff_members;
create trigger staff_join_general after insert on public.staff_members for each row execute function public.join_general();
