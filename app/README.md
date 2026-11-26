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

## Facility setup and Ask our policy

- **Facility setup** (`#/setup`): each home adds its own PDFs, Word files and text files (Google Docs: download as Word or PDF). Files are read on the device (`vendor/pdf.min.js`, `vendor/mammoth.browser.min.js`, self-hosted for the CSP), private details are stripped, and the text is split into short passages with their headings and page numbers. "Build this home's procedure layer" maps the passages to the what-if library.
- **Ask our policy** (`#/askpolicy`): shows the law first, then quotes this home's own passages with their source, then a conflict check done in code. If nothing in the home's documents matches, it says "Not covered by your policy". It searches only the selected home's documents; other homes are never searched. With the optional `facility-ask` function, Claude rewords the quoted passages, and every sentence must cite one of them.
- Sample documents for testing are in `../data/samples/` (fictional). Test data stays in the browser. See `../supabase/functions/facility-ask/README.md` for what production needs (per-facility tables with row-level security, server-side retrieval, BAAs).
