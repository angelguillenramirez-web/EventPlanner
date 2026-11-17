// Cancels the subscription: a free trial ends right away; a paid plan stops at the end of the period already paid.
import { admin, cors, json, stripe, userOf } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await userOf(req);
    if (!user) return json({ error: "not_signed_in" }, 401);
    const { data: row } = await admin().from("subscriptions").select("stripe_subscription_id, status").eq("user_id", user.id).maybeSingle();
    if (!row?.stripe_subscription_id) return json({ error: "no_subscription" }, 404);
    const s = stripe();
    if (row.status === "trialing") await s.subscriptions.cancel(row.stripe_subscription_id);
    else await s.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });
    return json({ ok: true }); // the webhook updates our table; the app refreshes it
  } catch (e) {
    console.error("cancel-subscription", e);
    return json({ error: "server" }, 500);
  }
});
