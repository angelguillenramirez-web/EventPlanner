import { createClient } from "@supabase/supabase-js";

/**
 * Supabase connection for 643. The URL and the PUBLISHABLE key are public by design (every table is protected by
 * row-level security, see staff/supabase/staff-schema.sql). NEVER put the service_role / secret key here.
 *
 * Real staff accounts are switched on with VITE_STAFF_AUTH=supabase (see staff/.env.example). Without it the console keeps
 * the local demo accounts, so development works before the database schema has been applied.
 */
export const SUPABASE_AUTH = import.meta.env.VITE_STAFF_AUTH === "supabase";
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "https://gzhssfgpvljinnvaofjz.supabase.co";
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_Jk214g3ClrPBQuzkDwCVfw_49L7fhSH";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce", storageKey: "sb-643-auth" },
});
