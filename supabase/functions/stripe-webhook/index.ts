// Supabase Edge Function "stripe-webhook": Stripe calls this after a payment or subscription change,
// and it marks the person's trial as paid (trials.paid_until) so the app stays open for them.
// Secrets: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Deploy with "Verify JWT" OFF (Stripe has no Supabase login);
// every call is checked with Stripe's signature instead.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "");
const whsec = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
// SUPABASE_SERVICE_ROLE_KEY is provided to Edge Functions by Supabase automatically. It stays on the server.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const GRACE_DAYS = 3; // a late card payment doesn't lock anyone out right away

function periodEnd(sub: Stripe.Subscription): number | null {
  // newer Stripe API versions keep the period on each item
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
}

async function markPaid(sub: Stripe.Subscription) {
  const email = (sub.metadata?.email ?? "").toLowerCase();
  if (!email) return;
  const end = periodEnd(sub);
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  const paidUntil = live && end ? new Date((end + GRACE_DAYS * 86400) * 1000).toISOString()
                  : new Date().toISOString(); // canceled or unpaid: access ends now (trial dates still apply)
  await admin.from("trials").update({
    paid_until: paidUntil,
    stripe_customer: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    plan: sub.metadata?.plan ?? undefined,
  }).eq("email", email);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whsec, undefined, Stripe.createSubtleCryptoProvider());
  } catch (_e) {
    return new Response("Bad signature", { status: 400 });
  }
  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.subscription) await markPaid(await stripe.subscriptions.retrieve(String(s.subscription)));
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.created") {
      await markPaid(event.data.object as Stripe.Subscription);
    }
  } catch (e) {
    console.error("webhook handling failed", e);
    return new Response("Error", { status: 500 }); // Stripe retries
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
