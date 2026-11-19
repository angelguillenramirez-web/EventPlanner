-- Patch 001: run ONCE in Supabase > SQL Editor if you applied staff-schema.sql before 19 Nov 2026 (knowledge base sync).
-- (Safe to run again.) New installs get this from staff-schema.sql already.
alter table public.kb_articles drop column if exists updated_by;
alter table public.kb_articles alter column id drop default;
alter table public.kb_articles alter column id type text using id::text;
alter table public.kb_articles alter column id set default gen_random_uuid()::text;
alter table public.kb_articles add column if not exists by_name text not null default '';

-- Only a super admin may edit articles (everyone on staff can read them).
drop policy if exists "kb: staff write" on public.kb_articles;
create policy "kb: staff write" on public.kb_articles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
