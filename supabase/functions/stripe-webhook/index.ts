// Stripe tells us what happened (subscribed, renewed, cancelled, payment failed). This is the only place that writes subscription state.
// Deploy with --no-verify-jwt: Stripe calls it, not a signed-in user. Authenticity is checked with the webhook signing secret instead.
import Stripe from "npm:stripe@17.5.0";
import { admin, planOfPrice, stripe } from "../_shared/billing.ts";

const sec = (n: number | null | undefined) => (n ? new Date(n * 1000).toISOString() : null);

async function save(sub: Stripe.Subscription, userId?: string) {
  const db = admin();
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  let uid = userId ?? (sub.metadata?.user_id as string | undefined);
  if (!uid) { const { data } = await db.from("subscriptions").select("user_id").eq("stripe_customer_id", customer).maybeSingle(); uid = data?.user_id; }
  if (!uid) { console.error("subscription without a known user", sub.id); return; }
  const item = sub.items.data[0];
  const info = planOfPrice(item?.price.id ?? "");
  const { data: prev } = await db.from("subscriptions").select("trial_used").eq("user_id", uid).maybeSingle();
  await db.from("subscriptions").upsert({
    user_id: uid,
    stripe_customer_id: customer,
    stripe_subscription_id: sub.id,
    plan: info?.plan ?? null,
    cycle: info?.cycle ?? null,
    status: sub.status,
    trial_end: sec(sub.trial_end),
    current_period_end: sec(item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_used: !!prev?.trial_used || sub.status === "trialing" || !!sub.trial_end,
  });
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(raw, sig ?? "", Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, Stripe.createSubtleCryptoProvider());
  } catch (e) {
    console.error("bad signature", e);
    return new Response("bad signature", { status: 400 });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) await save(await stripe().subscriptions.retrieve(String(s.subscription)), s.client_reference_id ?? undefined);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await save(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (e) {
    console.error("webhook handler", event.type, e);
    return new Response("error", { status: 500 }); // Stripe will retry
  }
  return new Response("ok");
});
