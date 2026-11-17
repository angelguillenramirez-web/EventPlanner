// Shared by the billing functions. Price IDs are public identifiers (not secrets).
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

export type Plan = "basic" | "planner" | "pro";
export type Cycle = "monthly" | "yearly";

/** Stripe price IDs (TEST mode). When going live, create the same prices in live mode and replace these. */
export const PRICES: Record<Plan, Record<Cycle, string>> = {
  basic:   { monthly: "price_1UcYdvRqFOBEZoMMLFyT9tvL", yearly: "price_1UcYeZRqFOBEZoMM52j0e65O" },
  planner: { monthly: "price_1UcYgGRqFOBEZoMMc75qH9ig", yearly: "price_1UcYftRqFOBEZoMMbM62JxV4" },
  pro:     { monthly: "price_1UcYh7RqFOBEZoMMLPCDHr5D", yearly: "price_1UcYjMRqFOBEZoMMxtzbkBrw" },
};
export const TRIAL_DAYS = 7;

export const planOfPrice = (priceId: string): { plan: Plan; cycle: Cycle } | null => {
  for (const p of Object.keys(PRICES) as Plan[]) for (const c of ["monthly", "yearly"] as Cycle[]) if (PRICES[p][c] === priceId) return { plan: p, cycle: c };
  return null;
};

/** Only these sites may be used as the return address after paying (prevents open redirects). */
const ALLOWED_ORIGINS = [
  "http://localhost:5173", "http://localhost:5176", "http://eventplanner.localhost:5173",
  "https://beige-penguin-970062.hostingersite.com", "https://1plan.com.mx", "https://www.1plan.com.mx",
];
export const safeOrigin = (o: unknown) => (typeof o === "string" && ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0]);

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const stripe = () => new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { httpClient: Stripe.createFetchHttpClient() });
/** Service-role client: bypasses row-level security. Only used inside these functions, never sent to the browser. */
export const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** The signed-in user making the request (from the Authorization header), or null. */
export async function userOf(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}
