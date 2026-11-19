-- Patch 002: run ONCE in Supabase > SQL Editor if you applied staff-schema.sql before the audit-log sync (safe to run again).
alter table public.audit_log add column if not exists by_name text not null default '';
alter table public.audit_log add column if not exists local_id text;
create unique index if not exists audit_log_local_id_key on public.audit_log (local_id);
