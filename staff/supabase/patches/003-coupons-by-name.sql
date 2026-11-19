-- Patch 003: run ONCE in Supabase > SQL Editor (coupon + plan price sync). Safe to run again.
alter table public.coupons add column if not exists by_name text not null default '';
