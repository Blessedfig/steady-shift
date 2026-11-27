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

## New resident admission (intake.js, `#/intake`)

Admitting someone from a hospital, another home, an MCO or family, with whatever papers they bring.

- **Files:** drop in any mix of PDFs, scans, photos, Word files, C-CDA (`.xml`) and FHIR (`.json`) exports. C-CDA and FHIR files are read for real in the browser; plain text is read line by line. PDFs, scans and photos are read on the server in the live version; in this test the sample packet shows what that would find, or the tester types the key lines.
- **In-app photos:** "Take photos of pages" opens the camera inside the page. Pictures are kept in page memory only (never localStorage, the camera roll or cloud photos), have no share or download button, and are cleared when sent to secure storage, when the person leaves Admissions, or after 2 minutes in the background. Every capture, view and change goes in an access log (who and when, never content). `window.SSCapture.panel()` is available for the orders screen.
- **Review:** every detail links to its source page with the words highlighted. Papers that disagree (meds, allergies vs NKDA, code status, diet texture, mobility, guardian vs POA) are flagged; medicines can be held for the prescriber or pharmacy. Meds, allergies, code status and who decides are confirmed one by one.
- **Checklist:** DHS 88 (AFH) or DHS 83 (CBRF) admission items with due dates from the admission date, what's in hand, what's missing, and a ready-to-send request for missing papers. Rule text was read from Justia (88.06), Cornell LII (83.35) and the DHS 83 PDF; items marked "being checked" still need the code text confirmed.
- **Confirm:** an RN or house manager confirms. The resident is added to the home, orders go into the shared `S.orders` store (ids `adm-…`, `source: 'Admission intake'`, verified when an RN confirms, otherwise pending), with `diet` and `track` for meals and handoff, and `window.SS_residentProfile(site, code)` returns the handoff starter.
- **Staff rules:** `#/intake/policy` has the phone and tablet rules (BYOD) and what the live version needs first (HIPAA program, BAAs with storage and AI vendors, native screenshot blocking, MDM for home tablets).
- Sample packet: `intake-samples.js`, fictional resident "Dot" (all names, providers and courts invented).
## Care plans (isp.js, isp-library.js, `#/isp`)

Individual service plans for each resident, written by the manager and read by every caregiver.

- **Rules:** DHS 88.06(3) for adult family homes (assessment and ISP within 30 days after placement; everyone who helped signs a statement of agreement and gets a copy; review at least every 6 months and when needs change) and DHS 83.35 for CBRFs (assessment before admission, temporary plan at admission, ISP within 30 days, resident or representative signs, review at least yearly and on change, every caregiver has access). Text read 2026-11-27. The Procedure check answer for AFH plan reviews (C01) was corrected from yearly to every 6 months.
- **Suggestions:** a first draft is built from the resident's record, nurse-checked orders (`SS_ordersFor`) and the admission intake (`SS_residentProfile`), plus a library of goals and supports from public plan formats (Family Care member-centered plan, IRIS, federal HCBS person-centered planning) and evidence-based practice (CDC STEADI, IDDSI, NPIAP, Alzheimer's Association, positive behavior support). Every item shows its source and why it was suggested, and everything is editable. Plan copy never names a managed care organization.
- **Guide me:** on by default. Walks one section at a time with what the section is, what good looks like, the legal must-haves and common mistakes, then a check before finishing (assessment date, measurable goals, who does what, resident took part, 8-step restriction rule, no blaming labels). A "first-month path" links the manager to Facility setup, Admissions, Orders, Team training, Delegations, Behavior help and the Survey-Ready Check.
- **Staff summary:** made from each finished version: code status, who decides, evacuation, what matters, how to help, what to watch for, when to tell the nurse, rights. Staff tap "I read this"; a new version asks them to read again and shows what changed. Managers see who has read it and can send a quiet reminder. Shown on the caregiver home and, when the face sheet screen is installed, at the top of it (`SSISP.faceBlock(code)` gives a per-resident block).
- **Signatures and versions:** participation and typed-name signatures per version (test only; the live version needs real e-signature), copies given, version history with a side-by-side compare, review reminders, and a flag when new orders arrive after the plan.

## Facility setup and Ask our policy

- **Facility setup** (`#/setup`): each home adds its own PDFs, Word files and text files (Google Docs: download as Word or PDF). Files are read on the device (`vendor/pdf.min.js`, `vendor/mammoth.browser.min.js`, self-hosted for the CSP), private details are stripped, and the text is split into short passages with their headings and page numbers. "Build this home's procedure layer" maps the passages to the what-if library.
- **Ask our policy** (`#/askpolicy`): shows the law first, then quotes this home's own passages with their source, then a conflict check done in code. If nothing in the home's documents matches, it says "Not covered by your policy". It searches only the selected home's documents; other homes are never searched. With the optional `facility-ask` function, Claude rewords the quoted passages, and every sentence must cite one of them.
- Sample documents for testing are in `../data/samples/` (fictional). Test data stays in the browser. See `../supabase/functions/facility-ask/README.md` for what production needs (per-facility tables with row-level security, server-side retrieval, BAAs).

## Meals, shift change report, menu and report forms (meals.js)

- **Meals** (`#/meals`): per-resident percent eaten, fluids, refusals, substitutes and help needed, with each person's diet, IDDSI texture and drink level, and allergies on the card. Verified orders with a `track` item (from `S.orders` via `SS_ordersFor`) add a required field for that resident. Flags for weight loss (5% in 30 days, 10% in 180 days), repeated refusals, low intake and fluids below goal go to the manager or RN. CSV export.
- **Shift change report** (`#/shift`): SBAR / I-PASS style hand-off. Pulls in reports, Night help, meal flags, call-ins and open shifts (SSSched/SSTime). "No change" is one tap. The incoming person ticks each to-do and watch item, can say it back and ask a question, then confirms. Managers see every report and time to confirm.
- **Menu and groceries** (`#/menu`): 4-week cycle menu with allergy, low-salt and texture checks and a substitute picker, a printable posted menu with change log, a grocery list from the menu minus the pantry, pantry counts with minimums, and a food budget with receipts that feeds the owner view.
- **Report forms** (`#/forms`): managers and owners turn fields on or off, require, rename, reorder or add fields per home. Each save is a new version, and saved reports keep the version they used.
- State lives in `S.care` (this browser only). Modules join the service switches through `SSAccess.register` (ids meals, shift, menu, forms).

## Face sheets and shift tasks (facesheet.js, `#/face`)

A start-of-shift face sheet for each sample resident, laid out like a standard long-term care admission face sheet. The top band always shows allergies, code status (with where the papers are), diet and texture, and fall, wandering and choking risk. Below: this shift's tasks (service plan, verified orders with tracking items, appointments from orders, and the last shift's to-dos) with check-offs, an end-of-shift reminder of anything not done (also pulled into the shift change report), communication and devices, history, faith and culture, "what helps", contacts with tap-to-call (guardian type and scope, POA and whether it is activated, emergency contacts, family, care team by specialty, pharmacy, preferred hospital, MCO care manager), insurance and end-of-life wishes. Medicare and Medicaid numbers and representative payee details show only to managers, RNs and owners, and each view is logged (`SSAccess.log`). New residents from admission intake fill in through `SS_residentProfile`. All people, phone numbers (555-01xx) and IDs are made up.
## Report something and Required reports (reports.js)

- **Report something** (`#/report`): staff describe what happened once. The app makes it professional, matches it to the events
  in `../data/reports/wi-reports.json`, and lists every report it needs: who gets each one (the DQA regional office for the home's county,
  the licensing agency, the Misconduct Reporting System, police, county adult protective services, the ombudsman, the health department,
  the MCO and the guardian), the deadline with a timer, the form, and the rule. "Track these reports" files a copy for the home, sends it to
  the manager's review list, and opens a tracker (`#/report/case:<id>`) with a pre-filled draft and "Mark sent" for each one.
- **Required reports** (`#/required`): every report, planned change, record to keep and regular duty for the home's setting (AFH or CBRF),
  plus where reports go and all four regional offices with their counties.
- The county comes from Facility setup (with a list of all 72 counties). AFHs also say whether DQA or a county licensed them.

## Getting started academy (academy.js, `#/academy`)

For new homes, new owners and people getting into care. Content is in `academy-data.js`; the free public preview of Track 1 is `../academy.html`.

- **Track 1, start a home in Wisconsin:** AFH vs CBRF, DQA licensing steps, forms and fees, policies, staffing and required training, Family Care, IRIS and private-pay contracts, insurance and budgeting, and the most-cited rules (from the Survey-Ready data, the peer library and Regulatory Watch). Every unit says whether it rests on an official rule (linked) or is Steady Shift guidance.
- **Track 2, set up Steady Shift:** a checklist per area that ticks itself where the app can tell (profile, documents, procedure layer, shifts, training blocks, admissions, reports).
- **Track 3, role training:** short modules for caregivers, managers and owners with quizzes (pass mark 80%) and printable certificates. Suggested hours wait on Team training until a manager counts them; counted hours go on the staff record the scheduler's training check reads. Marked everywhere as in-house training, not DHS-approved.
- **Track 4, run the business:** LLC and registrations, permits beyond DQA, insurance, bookkeeping, the building, pay and growth. Units carry `verticals` so in-home care and adult day services can reuse them later.
- **Toolkit:** inventory and expenses (food receipts from Menu are added in; totals show on the Owner view), pay benchmarks, hiring cost planner, startup and expansion model.
- **Pay data:** `wages-data.js` (`window.SS_WAGES`) is the one shared source for the academy and owner labor analytics. Wisconsin area values (`DATA`) are empty until read from the BLS OEWS May 2025 tables; screens show the verified national anchors with a "being checked" mark and a link to the official area lookup.

## Cleaning checklist (cleaning.js, `#/clean`)

A shift housekeeping checklist that starts from a standards-based list (Wisconsin DHS 88/83 sanitary and safe environment, CDC environmental infection control, FDA Food Code, OSHA bloodborne pathogens, common fire-safety checks). Managers edit it per home (wording, every shift / daily / weekly / monthly, which shift, owner, photo needed), with versions. Staff check jobs off; unfinished every-shift and daily jobs show on Home near shift change and in the shift change report. Optional photo sign-off with the in-app camera (rooms and equipment only, kept in memory until leaving the screen; the record notes that a photo was taken). "Where to check or ask" links the rule text, CDC, EPA disinfectants, FDA Food Code, OSHA and Wisconsin local health departments, with a question box to the manager. History shows 14 days of completion and exports a CSV for surveys. State lives in `S.clean`. Module id `clean`.
- "Money and people sync" (`#/money`, `money.js`, owner, multi-site and manager menus): pick the accounting tool (QuickBooks Online, Xero, Wave, FreshBooks, QuickBooks Desktop) and payroll (Gusto, ADP, Paychex, other); match Steady Shift categories to the chart of accounts; download a QuickBooks bank upload file of expenses (from Inventory and expenses and groceries), a private-pay invoice import file, a Family Care and IRIS deposits file, and an hours file for payroll from approved time sheets. Tracks MCO and IRIS payments received, shows a sample monthly money view, and lists birthdays (staff opt in; residents appear as "Resident birthday" with no name), work anniversaries and staff hours. `window.SSPeopleDates(siteIds)` adds those dates to Sync and calendar. Connect buttons are placeholders: live sign-in uses each company's own OAuth page, with tokens kept server side.

## Do it by chat (assistant.js, `#/assistant`)

For people who would rather type than tap through screens. It is in every role's menu, right under Home, and on the home screen.

- **Look things up:** "what's due this week", "who's working tonight", "when is my next shift", "open shifts next week", "show the requests waiting", "reports waiting", "can I pre-pour meds?" (answers come from Procedure check, with the rule source), resident codes and the staff list.
- **Do things, always after a confirm card:** add a shift or an open shift ("schedule Caregiver B 7-3 Tuesday"), give a shift to someone, set who is on call, approve or decline a request, ask for time off ("I need Dec 24 off"), write a report ("log a fall for room 2 ...", using the same professional rewrite and mandatory-report check as Report something, editable before sending), log a meal ("Ruth ate 75% of lunch"), clock in or out or take a break, and send a question to the manager's question log. Nothing is saved until the person taps yes. Typing something else instead cancels the card.
- **Roles:** each action lists the roles that may use it (caregiver, house manager, RN, owner, multi-site, family), and the screen it belongs to. Schedule changes also work for staff a manager shared "edit the schedule" or "approve requests" with in Services and access. If a service is switched off for the home or role, chat can't use it either. Owners can switch chat itself off per home or role ("Do it by chat" in Services and access).
- **Two modes:** with the AI helper on (Supabase Edge Function `app-chat`, `mode: "assistant"`), Claude reads the request and picks the actions; the page runs them on its own data and returns the results. Without it, a built-in command reader handles the common requests with the same actions and the same confirm cards, so it works today.
- **Privacy:** the conversation lives in page memory only and is cleared on reload or when "View as" or the home changes. Only resident codes (never names or notes) and staff names are sent to the AI as context. Test version, sample data only.
- "Vendors" (`#/vendors`) and "Resident spending" (`#/resfunds`), both in `vendors.js`: managed vendors with contacts, contract end and renewal, a health-information (BAA) flag, recurring orders (record when it arrives, or skip), purchases (home expense, from a resident's funds, or bill the resident), spend per vendor, and a vendor list file for QuickBooks. Resident spending keeps each resident's personal funds ledger (money in, spent with receipt and witness, charges to bill), ongoing personal expenses, and a statement file for the resident or guardian. Vendor purchases flow into the QuickBooks expenses file, resident charges into the invoice file, and contract dates and orders into Sync and calendar through `window.SSCalendarFeeds`. APIs: `window.SSVendors`, `window.SSResFunds`.

## Employee files (hr.js, hr-data.js, `#/hr`, `#/myfile`, `#/celebrate`)

HR in one place for each staff member, built to SHRM-style practice and Wisconsin rules (checked 2026-11-27; swap in the owner's HR workbook standards when it arrives). Switchable module `hr` in Services and access.

- **Who sees what:** an employee sees their own file (`#/myfile`), a house manager sees the staff of their home, owners see everyone. Every file, tab and medical-file opening is written to an access log (`S.hr.log`), and the employee can see who opened theirs.
- **Compliance:** background check and 4-year recheck (the date also updates the staff record the scheduler checks), health screening, I-9 (kept apart), W-4/WT-4, job description, orientation, CPR, meds, fire safety, bloodborne pathogens, dementia (CBRF), licenses. Expirations show on "Due and expiring" and a manager home tile. Training hours and Academy certificates are read from Team training.
- **Medical file:** separate and locked (ADA). Owner only by default; owners can add the house manager. Opening it asks for a reason that is logged. Others see only "on file / due" and any work limit, never a diagnosis.
- **Write-ups:** progressive steps, behavior-based fields, a wording check that flags subjective or protected-class words (a nudge, not a block), "I received this" acknowledgment and the employee's response. Final warnings and above wait for owner review.
- **Reviews, raises and promotions:** job-based ratings with examples. Managers suggest raises without seeing pay (unless the owner allows it); owners approve. Approved changes update the rate used by Labor and pay (`D.SCHED.profiles`) from their start date.
- **Development (opt-in):** a work-style check-in and strengths the employee picks. Labeled development only, owned by the employee, shared only if they choose, and never shown on reviews, pay or write-ups. Not a personality test.
- **Also:** character sheet with skills, preferences, thank-yous and factual manager notes ("Planning" notes are hidden from the employee per Wis. Stat. 103.13(6)); onboarding and offboarding checklists; PTO ledger and policy; document index (names only in the test); individual insights (no scores); Wis. Stat. 103.13 inspection requests with the 7-working-day due date, the employee's attached statements and a printable copy; retention guide with legal hold.
- **Birthdays and milestones (`#/celebrate`):** staff birthdays (month and day only, opt-in: only me / managers / team) and work anniversaries, resident birthdays from the face sheet, and meaningful dates with what helps.
- Hooks: `window.SSHR` (`summary`, `upcoming`, `profileHooks`); the Insights tab shows `SSVoice.card(site, name)` when the staff voice log is installed.
