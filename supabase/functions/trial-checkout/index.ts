// Supabase Edge Function "trial-checkout": opens a Stripe Checkout page for a trial user's chosen plan.
// The Stripe secret key lives only here, as the Supabase secret STRIPE_SECRET_KEY. Never put it in the repo or the page.
// Until it is deployed with a key and at least one price, the app records the plan choice and we follow up by email.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://blessedfig.github.io";
const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// One Stripe Price ID per plan (monthly, recurring), set as secrets. Plans without a price are handled by email.
const PRICES: Record<string, string | undefined> = {
  home: Deno.env.get("STRIPE_PRICE_HOME"),
  facility: Deno.env.get("STRIPE_PRICE_FACILITY"),
  family: Deno.env.get("STRIPE_PRICE_FAMILY"),
  nurse: Deno.env.get("STRIPE_PRICE_NURSE"),
  agency: Deno.env.get("STRIPE_PRICE_AGENCY"),
};
const key = Deno.env.get("STRIPE_SECRET_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  const ready = Object.entries(PRICES).filter(([, v]) => !!v).map(([k]) => k);
  if (body.ping) return json({ ok: !!key && ready.length > 0, plans: key ? ready : [], test: !!key && key.startsWith("sk_test_") });
  if (!key) return json({ error: "Payments are not set up yet" }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await db.auth.getUser();
  const email = u?.user?.email?.toLowerCase();
  if (!email) return json({ error: "Sign in first" }, 401);
  const { data: access } = await db.rpc("app_access");
  if (!access?.trial) return json({ error: "No trial found for this account" }, 403);

  const plan = String(body.plan ?? "");
  const price = PRICES[plan];
  if (!price) return json({ error: "That plan can't be paid online yet" }, 400);
  const back = typeof body.return_url === "string" && body.return_url.startsWith(ALLOWED_ORIGIN + "/")
    ? body.return_url : ALLOWED_ORIGIN + "/steady-shift/app/";

  const stripe = new Stripe(key);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    customer_email: access.trial.stripe_customer ? undefined : email,
    client_reference_id: email,
    metadata: { email, plan },
    subscription_data: { metadata: { email, plan } },
    allow_promotion_codes: true,
    success_url: back + "?paid=1",
    cancel_url: back,
  });
  // note the choice on the desk too (same as choosing without payment)
  await db.rpc("choose_plan", { p_plan: plan, p_note: "Opened online checkout" });
  return json({ url: session.url });
});
