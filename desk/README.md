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
