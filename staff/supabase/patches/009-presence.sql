-- Patch 009: "who is viewing this request" (Supabase Realtime presence). Run ONCE in Supabase > SQL Editor. Safe to run again.
-- Only active staff can join the private channels named task:<request id>. Nothing is stored in a table.
drop policy if exists "staff presence: read"  on realtime.messages;
drop policy if exists "staff presence: write" on realtime.messages;
create policy "staff presence: read"  on realtime.messages for select to authenticated using (public.is_staff() and realtime.topic() like 'task:%');
create policy "staff presence: write" on realtime.messages for insert to authenticated with check (public.is_staff() and realtime.topic() like 'task:%');
