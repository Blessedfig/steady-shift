# Owner Desk

Private working desk for the business owners: progress, sales leads, marketing copy and notes.
Served at https://blessedfig.github.io/steady-shift/desk/ and not linked from the public site.

## How it stays private

- Sign-in is by emailed link (Supabase Auth). New sign-ups are refused by the page.
- Saved data lives in Supabase, not in this repo. The rules in `setup.sql` let only signed-in
  people whose email is in `desk_members` read or change anything.
- `config.js` holds the project URL and the publishable/anon key. Those are meant to be public.
  Never put a `service_role` or secret key in this repo.
- No resident names or health details go in the desk. Business contacts only.

## Setup (once)

1. Create a free Supabase project.
2. SQL Editor: run `setup.sql` with the real emails at the bottom.
3. Authentication > URL Configuration: set Site URL and a Redirect URL to the desk address above.
4. Authentication > Users: invite each person.
5. Put the project URL and publishable key in `config.js`.

## Adding or removing someone

In the Supabase SQL Editor:

```sql
insert into public.desk_members (email) values ('name@example.com');
delete from public.desk_members where email = 'name@example.com';
```

Then invite them under Authentication > Users (or delete their user there).

`vendor/supabase-js-2.118.0.js` is the unmodified Supabase JS client (MIT, see `vendor/SUPABASE-LICENSE.txt`).

## Executive summary tab

The planning summaries and their questions are rows of kind `summary` in `desk_items`, loaded through the Supabase SQL editor rather than kept in this public repo. Answers and ideas people type are rows of kind `answer` (`cat`, `q`, `question`, `text`, `by`). A row whose data has `"only": "<email>"` is visible to that one member only; the rules in `setup.sql` enforce this. To read the answers, use "Copy answers for Claude" on the tab, or open Table Editor > desk_items in Supabase and filter kind = answer.

## Optional hardening (recommended before real customers)

`hardening.sql` adds database-stamped "who changed this" and an append-only activity log. It does not change who can see what. Run it once in Supabase > SQL Editor. Also recommended, in the Supabase dashboard: turn on multi-factor authentication for owner accounts, enable leaked-password protection, and keep Point-in-Time Recovery or daily backups on.

## Trial codes (free 2-week trials)

The "Trial codes" tab makes codes that Angelika or Christian hand out. Someone with a code opens
`https://blessedfig.github.io/steady-shift/app/?code=SS-XXXX-XXXX` (or taps "Start my free trial" on the app's
sign-in screen), creates an account with email and password, confirms with the 6-digit code from the email, and gets
the whole test app for 14 days. A bar at the top counts down; in the last 3 days, and after the trial ends, they're
asked to pick a plan (see `supabase/functions/trial-checkout/README.md` for payments). Trial users are never added to
`desk_members`, so they can't see this desk.

### Turn on trial codes (Christian, about 10 minutes, once)

Order matters: the hook in step 2 must be on before sign-ups are turned on in step 3.

1. **SQL.** Supabase > SQL Editor > New query > paste all of `trials.sql` > Run.
2. **Sign-up gate.** Authentication > Hooks (Auth Hooks) > Add hook > "Before User Created" > type Postgres >
   schema `public`, function `trial_signup_hook` > Create/Enable.
3. **Allow sign-ups.** Authentication > Sign In / Providers > turn ON "Allow new users to sign up". Keep "Confirm email" ON.
   (The hook refuses every sign-up that has no valid code, so the app is still invite-only for everyone else.)
4. **Email with a code.** Authentication > Emails > "Confirm signup" template: add a line such as
   `Your code: {{ .Token }}` so people on phones can type the code instead of tapping the link.
5. **Redirect.** Authentication > URL Configuration > Redirect URLs > add `https://blessedfig.github.io/steady-shift/app/`.
6. **Check it.** On the desk, open Trial codes > Make codes. Then in a private browser window open the code's link and
   sign up with a spare email. Also try signing up with a made-up code: it must be refused.

**Inviting someone new to the desk after this:** add their email to `desk_members` first (SQL above), then invite them.
The hook lets an invite through only for emails already on `desk_members`.

**Undo:** turn "Allow new users to sign up" back off. Existing trial accounts keep working.

