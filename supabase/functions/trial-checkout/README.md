# Payments for trial users (Stripe), not switched on yet

When a free trial is ending, the app shows a plan screen. Right now, picking a plan **records the choice** and puts a note on the Owner Desk (Requests for Claude, "Trial: plan choice"), and we follow up by email. Nobody is charged.

These two server functions let the same buttons open a real Stripe payment page instead:

- `trial-checkout`: makes a Stripe Checkout page for the chosen plan. The app checks for it automatically and changes the button to "Continue to payment" for plans that have a price.
- `stripe-webhook`: Stripe tells it when someone has paid, renewed or canceled, and it sets `trials.paid_until` so the app stays open for paying people.

The Stripe secret key is stored only as a Supabase secret. It is never in this repo, the web page, or a chat.

## Turn it on (Christian, about 30 minutes, done once)

Start in **test mode** (fake cards, no real money). Switch to live only when prices are final and the business details are set.

1. **Stripe account.** Sign up at https://dashboard.stripe.com/register. Leave "Test mode" on (toggle at the top right).
2. **Products and prices.** Product catalog > Add product. Make one product per plan you want to sell online, each with a **recurring monthly** price, for example Home suite $59 and Facility suite $149 (CBRFs up to 20 beds). Founding-home prices ($35 Home, $89 Facility for 12 months) work best as a Stripe coupon; yearly billing (Home $590) can be a second, yearly price. CBRFs over 20 beds ($229), Multi-site ($119 per site) and Rules Check only ($22) are set up by email for now. Copy each price's ID (starts with `price_`).
3. **Secret key.** Developers > API keys > copy the **Secret key** (`sk_test_...`). Paste it only into Supabase in step 5, nowhere else.
4. **Deploy the functions.** Supabase > project "owner-desk" > Edge Functions > Deploy a new function > Via editor:
   - Name `trial-checkout`, paste `supabase/functions/trial-checkout/index.ts`, deploy. Leave "Verify JWT" **on**.
   - Name `stripe-webhook`, paste `supabase/functions/stripe-webhook/index.ts`, deploy. Turn "Verify JWT" **off** for this one (Stripe can't sign in; the function checks Stripe's signature instead).
5. **Secrets.** Edge Functions > Secrets > add:
   - `STRIPE_SECRET_KEY` = the key from step 3
   - `STRIPE_PRICE_HOME`, `STRIPE_PRICE_FACILITY`, `STRIPE_PRICE_FAMILY` (and `STRIPE_PRICE_NURSE`, `STRIPE_PRICE_AGENCY` if you sell those) = the price IDs from step 2. Leave out any plan you'd rather set up by hand.
6. **Webhook.** In Stripe: Developers > Webhooks > Add endpoint. URL: `https://umwebrbyusatucjixdju.supabase.co/functions/v1/stripe-webhook`. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Save, then copy the **Signing secret** (`whsec_...`) into a Supabase secret named `STRIPE_WEBHOOK_SECRET`.
7. **Try it.** Sign in to the app with a trial account, open the plan screen, pick Home, and pay with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). The trial list on the Owner Desk should show "Paid until ...".

Multi-site plans and "Is the price a stretch?" answers (Rules Check at $22, or one more free month) are handled by email, so you can agree on a price with each home. To give a home a lower price in Stripe, make a coupon (Product catalog > Coupons) and send them a promotion code; the checkout page accepts codes.

## Before taking real money

- Final prices and plan names (all prices on the site are drafts).
- Business details in Stripe, a refund and cancellation policy, and a terms-of-service page.
- Customer portal (Stripe Settings > Billing > Customer portal) so people can cancel or change cards themselves.
- Paying customers still get the test version. No real resident data until the HIPAA plan is done.

## Turn it off

Delete the `STRIPE_SECRET_KEY` secret. The app goes back to recording plan choices.
