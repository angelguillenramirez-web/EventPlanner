-- A plan: database setup (run once in Supabase > SQL Editor > New query > paste > Run).
-- Safe to run again: every statement is idempotent.

-- 1) Profiles: one row per account, created automatically at sign-up.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text not null default '',
  account_type text not null default 'planner' check (account_type in ('planner', 'supplier')),
  created_at   timestamptz not null default now()
);

-- 2) Workspaces: each planner's whole workspace (events, guests, tasks...) as one JSON document.
create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3) Row-level security: a signed-in user can only touch their OWN rows. Nobody can read others'.
alter table public.profiles   enable row level security;
alter table public.workspaces enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: read own"   on public.profiles for select to authenticated using (auth.uid() = user_id);
create policy "profiles: update own" on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workspaces: read own"   on public.workspaces;
drop policy if exists "workspaces: insert own" on public.workspaces;
drop policy if exists "workspaces: update own" on public.workspaces;
drop policy if exists "workspaces: delete own" on public.workspaces;
create policy "workspaces: read own"   on public.workspaces for select to authenticated using (auth.uid() = user_id);
create policy "workspaces: insert own" on public.workspaces for insert to authenticated with check (auth.uid() = user_id);
create policy "workspaces: update own" on public.workspaces for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workspaces: delete own" on public.workspaces for delete to authenticated using (auth.uid() = user_id);

-- 4) Keep updated_at fresh.
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch before update on public.workspaces for each row execute function public.touch_updated_at();

-- 5) On sign-up, create the profile (name and account type come from the sign-up form).
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, email, full_name, account_type)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'account_type' = 'supplier' then 'supplier' else 'planner' end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- The sign-up trigger is internal: block it from being called through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
