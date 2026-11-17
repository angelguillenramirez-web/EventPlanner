// Starts a Stripe Checkout (subscription). The 7-day free trial exists only on Essential and only once per account.
import { PRICES, TRIAL_DAYS, admin, cors, json, safeOrigin, stripe, userOf, type Cycle, type Plan } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await userOf(req);
    if (!user) return json({ error: "not_signed_in" }, 401);
    const body = await req.json();
    const plan = body.plan as Plan, cycle = body.cycle as Cycle;
    const price = PRICES[plan]?.[cycle];
    if (!price) return json({ error: "bad_plan" }, 400);
    const origin = safeOrigin(body.origin);
    const s = stripe(), db = admin();

    // one Stripe customer per account
    const { data: row } = await db.from("subscriptions").select("stripe_customer_id, trial_used, status").eq("user_id", user.id).maybeSingle();
    let customer = row?.stripe_customer_id as string | undefined;
    if (!customer) {
      const c = await s.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
      customer = c.id;
      await db.from("subscriptions").upsert({ user_id: user.id, stripe_customer_id: customer });
    }
    // already subscribed: changes go through the billing portal
    if (row && ["active", "trialing", "past_due"].includes(row.status)) return json({ error: "already_subscribed" }, 409);

    const trial = plan === "basic" && !row?.trial_used;
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      payment_method_collection: "always", // the card is required even during the trial
      subscription_data: {
        metadata: { user_id: user.id },
        ...(trial ? { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } } : {}),
      },
      allow_promotion_codes: true,
      success_url: `${origin}/#/app/account/billing`,
      cancel_url: `${origin}/#/app/account/billing`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("create-checkout", e);
    return json({ error: "server" }, 500);
  }
});
