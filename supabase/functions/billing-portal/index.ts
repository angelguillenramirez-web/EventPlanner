// Opens Stripe's Customer Portal: update the card, switch plan, see invoices, cancel.
import { admin, cors, json, safeOrigin, stripe, userOf } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await userOf(req);
    if (!user) return json({ error: "not_signed_in" }, 401);
    const body = await req.json().catch(() => ({}));
    const { data: row } = await admin().from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!row?.stripe_customer_id) return json({ error: "no_customer" }, 404);
    const session = await stripe().billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: `${safeOrigin(body.origin)}/#/app/account/billing` });
    return json({ url: session.url });
  } catch (e) {
    console.error("billing-portal", e);
    return json({ error: "server" }, 500);
  }
});
