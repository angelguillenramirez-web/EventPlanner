-- Patch 008: customer support through Supabase (replaces the local bridge online). Run ONCE in Supabase > SQL Editor. Safe to run again.
-- 1Plan writes a thread (+ messages) for each live chat or written request; 643 turns them into requests and writes staff replies back.
alter table public.support_threads add column if not exists kind text not null default 'support';
alter table public.support_threads add column if not exists customer_name text not null default '';
alter table public.support_threads add column if not exists customer_email text not null default '';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'support_threads_kind_check') then
    alter table public.support_threads add constraint support_threads_kind_check check (kind in ('support', 'design'));
  end if;
end $$;
alter table public.support_messages add column if not exists local_id text;
create unique index if not exists support_messages_local_id_key on public.support_messages (local_id);

-- The ticket number is always assigned by the database (customers cannot choose it): SUP-000001, DSN-000001 …
create sequence if not exists public.support_ref_seq;
create sequence if not exists public.design_ref_seq;
create or replace function public.set_thread_ref() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.ref := case when new.kind = 'design' then 'DSN-' || lpad(nextval('public.design_ref_seq')::text, 6, '0') else 'SUP-' || lpad(nextval('public.support_ref_seq')::text, 6, '0') end;
  new.customer_name  := left(new.customer_name, 120);
  new.customer_email := left(new.customer_email, 200);
  new.subject        := left(new.subject, 200);
  return new;
end $$;
revoke execute on function public.set_thread_ref() from public, anon, authenticated;
drop trigger if exists support_threads_ref on public.support_threads;
create trigger support_threads_ref before insert on public.support_threads for each row execute function public.set_thread_ref();
