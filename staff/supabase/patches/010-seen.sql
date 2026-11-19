-- Patch 010: "Seen" time on staff replies (shown only to the support team). Run ONCE in Supabase > SQL Editor. Safe to run again.
-- The customer app calls mark_messages_seen() while the customer has the support panel open; customers can set nothing else.
alter table public.support_messages add column if not exists seen_at timestamptz;
create or replace function public.mark_messages_seen(p_thread uuid) returns void language sql security definer set search_path = '' as $$
  update public.support_messages m set seen_at = now()
  where m.thread_id = p_thread and m.from_staff and not m.internal and m.seen_at is null
    and exists (select 1 from public.support_threads t where t.id = p_thread and t.customer_id = auth.uid());
$$;
revoke execute on function public.mark_messages_seen(uuid) from public, anon;
grant  execute on function public.mark_messages_seen(uuid) to authenticated;
