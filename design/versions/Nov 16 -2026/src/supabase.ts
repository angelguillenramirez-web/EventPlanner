import { createClient } from "@supabase/supabase-js";

/**
 * Supabase connection.
 * The URL and the PUBLISHABLE key are public by design: they only identify the project, and every table is
 * protected by row-level security (see supabase/schema.sql). NEVER put the service_role / secret key here.
 * Override them per environment with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "https://gzhssfgpvljinnvaofjz.supabase.co";
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_Jk214g3ClrPBQuzkDwCVfw_49L7fhSH";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
});

/** Quick health check: true when the auth service answers. */
export async function supabaseReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } });
    return r.ok;
  } catch { return false; }
}
