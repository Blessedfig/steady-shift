# Steady Shift test app

Private, signed-in test version of the subscriber app at https://blessedfig.github.io/steady-shift/app/
with every plan unlocked and a "View as" switcher (caregiver, house manager, RN, owner, multi-site operator, family caregiver).

- Sign-in reuses the Owner Desk's Supabase project (`../desk/config.js`). Only desk members get in. A session from the desk works here too, since both pages share the same site.
- All residents, homes and records are fictional sample data in `data.js`. Changes people make while testing are saved only in their own browser (localStorage). "Reset sample data" on the home screen clears them.
- "Ideas and fixes" opens a chat. It uses Claude through the Supabase Edge Function in `../supabase/functions/app-chat` when that is set up (see its README), and otherwise a guided chat (scripted) that asks what, where, why and how soon, then saves a row of kind `request` (with `source: "test-app"`) to `desk_items`, so it shows on the desk under Requests for Claude. The chat's second tab shows the person's own notes with any reply typed on the desk.
- The casual-to-professional rewrite is a template (word swaps, name removal, flags), not an AI service.
- Rule content comes from the Wisconsin rulebook and Rule Conflicts docs (checked 2026-11-26). Not legal advice.
- "Sync and calendar" (`#/sync`, in the manager, RN, owner and multi-site menus) turns app follow-ups (reports waiting, RN delegation reviews, training catch-up, rule-change dates, on-call check) into Google Calendar and Outlook links, a single .ics file or a .csv for Sheets, Excel and shift tools. Its team chat demo builds a Microsoft Teams Workflows card or a Google Chat message from the same item. A pasted test webhook link stays on the page and is never saved. No resident names or codes go into any export.

## Free trials (trial.js)

People with a trial code made on the Owner Desk can create their own account from the sign-in screen
("Start my free trial", or a link like `app/?code=SS-XXXX-XXXX`). They get every screen for 14 days, with a countdown
bar at the top. In the last 3 days the plan screen opens once a day, and after the trial ends it is the only screen
they see until they pick a plan. Plan choices land on the desk under Requests for Claude ("Trial: plan choice").
Database rules: `desk/trials.sql`. Turning it on: `desk/README.md` > "Turn on trial codes". Payments:
`supabase/functions/trial-checkout/README.md`. Until `trials.sql` is run, the app behaves exactly as before (desk members only).

## What's worked for others (peer-data.js, `#/peer`)

A shared "what's worked for others" library on top of the rule conflicts (C01-C18). 43 entries are seeded from public
sources (WI DHS guidance and DQA survey and enforcement reports, MN and MI investigation reports, IA survey trends, the WI ombudsman, an AHRQ case study, a WI court decision and bill, caregiver forums, news), each cited by agency and year with no home named, plus two clearly
marked fictional member samples. Each entry has the situation, what the home does, how it played out, an outcome
(regulator accepted, cited, contested, untested), the rule it relates to, and upvotes. Every screen says
"Peer practice, not legal advice".

- **Kept apart from private documents.** The peer screens never read a home's procedures, policies or reports. Something
  reaches the shared layer only when a person submits it on purpose, it is scrubbed, consent is ticked, and a reviewer
  approves it.
- **Incident patterns.** A report becomes a scenario (situation, response, outcome) after a HIPAA Safe Harbor scrub
  (names, places, dates except year, times to shift, phone/email/IDs, room numbers, ages over 89). Pooled patterns show
  only when at least 11 homes contributed.
- **Test only.** Everything stays in the browser. The "Before real data" tab lists what must be in place first
  (HIPAA program, BAAs, consent terms, a signed-off de-identification method, staffed review, Wisconsin confidentiality check).
- "Doctor orders" (`#/orders`, in the manager and RN menus) takes a new order from a visit summary, fax, phone read-back, discharge or pharmacy, tagged by care area (primary care, psychiatry and behavioral health, dental, therapy, pharmacy, hospice, home health, other specialist, hospital). A picture can be attached for the page only; it is never saved. Each line goes to a nurse check before staff see it. Checked orders are the one shared order store, `S.orders`, read by other screens through `window.SS_ordersFor(site, res)`. An order can carry `track` (what staff record, how often, in the meal log or shift handoff) and, for diet orders, `diet` (texture, liquids, allergies). Behavioral health orders hold only the instruction staff need, never therapy notes. A "Care team at a glance" table shows each resident's care areas and next visit. Appointment orders also appear on Sync and calendar.
