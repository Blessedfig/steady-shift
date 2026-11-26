-- Free trial codes for the Steady Shift test app (Supabase project "owner-desk").
-- Christian runs this once: Supabase > SQL Editor > New query > paste the whole file > Run. Running it again is safe.
-- Then follow the "Turn on trial codes" steps in desk/README.md (hook, sign-ups, email template).
--
-- How it works:
--   trial_codes : codes Christian and Angelika make on the Owner Desk. Each has a trial length (14 days by default),
--                 how many people may use it, and an optional last day to redeem it.
--   trials      : one row per person who signed up with a code: when the trial ends and which plan they picked.
--   trial_signup_hook : runs inside Supabase Auth before any new account is created. It lets a sign-up through
--                 only if the email is already on desk_members (an invite) or it carries a valid, unused code.
--                 Everyone else is refused, so the app stays invite-only for people without a code.
-- Trial users never become desk members. They can use the test app and send ideas from its chat, nothing else.
-- No resident or health information is stored here: only the email, the code and dates.

-- 1. Tables
create table if not exists public.trial_codes (
  code       text primary key check (code ~ '^[A-Z0-9][A-Z0-9-]{4,31}$'),
  trial_days int  not null default 14 check (trial_days between 1 and 90),
  max_uses   int  not null default 1  check (max_uses between 1 and 500),
  uses       int  not null default 0  check (uses >= 0),
  expires_at timestamptz,
  active     boolean not null default true,
  note       text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  created_by text default lower(auth.jwt() ->> 'email')
);
alter table public.trial_codes enable row level security;
revoke all on public.trial_codes from anon, authenticated;
grant select, insert, update on public.trial_codes to authenticated;

drop policy if exists "desk members read codes"   on public.trial_codes;
drop policy if exists "desk members add codes"    on public.trial_codes;
drop policy if exists "desk members change codes" on public.trial_codes;
create policy "desk members read codes"   on public.trial_codes for select to authenticated using (public.is_desk_member());
create policy "desk members add codes"    on public.trial_codes for insert to authenticated with check (public.is_desk_member() and uses = 0);
create policy "desk members change codes" on public.trial_codes for update to authenticated using (public.is_desk_member()) with check (public.is_desk_member());

create table if not exists public.trials (
  email          text primary key check (email = lower(email)),
  code           text references public.trial_codes(code),
  name           text check (char_length(name) <= 120),
  home_type      text check (char_length(home_type) <= 40),
  started_at     timestamptz not null default now(),
  ends_at        timestamptz not null,
  plan           text check (char_length(plan) <= 40),
  plan_note      text check (char_length(plan_note) <= 1000),
  plan_chosen_at timestamptz,
  paid_until     timestamptz,           -- set by the Stripe webhook once payments are switched on
  stripe_customer text
);
alter table public.trials enable row level security;
revoke all on public.trials from anon, authenticated;
grant select, update on public.trials to authenticated;

drop policy if exists "desk members read trials"   on public.trials;
drop policy if exists "desk members change trials" on public.trials;
drop policy if exists "people read their own trial" on public.trials;
create policy "desk members read trials"    on public.trials for select to authenticated using (public.is_desk_member());
create policy "desk members change trials"  on public.trials for update to authenticated using (public.is_desk_member()) with check (public.is_desk_member());
create policy "people read their own trial" on public.trials for select to authenticated using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 2. The sign-up gate (Supabase "Before User Created" auth hook)
create or replace function public.trial_signup_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  em text := lower(coalesce(event -> 'user' ->> 'email', ''));
  meta jsonb := coalesce(event -> 'user' -> 'user_metadata', '{}'::jsonb);
  c  text := upper(regexp_replace(coalesce(meta ->> 'trial_code', ''), '\s', '', 'g'));
  v  public.trial_codes;
begin
  -- People Christian invites: add them to desk_members first, then invite.
  if em <> '' and exists (select 1 from public.desk_members where email = em) then
    return '{}'::jsonb;
  end if;
  if c = '' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'Steady Shift is invite only. To sign up you need a free trial code.'));
  end if;
  if em = '' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Please sign up with an email address.'));
  end if;
  if exists (select 1 from public.trials where email = em) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 409,
      'message', 'This email has already used a free trial. Sign in instead, or ask us about a plan.'));
  end if;
  update public.trial_codes
     set uses = uses + 1
   where replace(code, '-', '') = replace(c, '-', '') and active and uses < max_uses and (expires_at is null or expires_at > now())
  returning * into v;
  if not found then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403,
      'message', 'That trial code is not valid, has expired, or has already been used.'));
  end if;
  insert into public.trials (email, code, name, home_type, ends_at)
  values (em, v.code, left(nullif(trim(meta ->> 'name'), ''), 120), left(nullif(meta ->> 'home_type', ''), 40),
          now() + make_interval(days => v.trial_days));
  return '{}'::jsonb;
end;
$$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.trial_signup_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.trial_signup_hook(jsonb) from public, anon, authenticated;

-- 3. What the app asks after sign-in: "may this person use the app, and how long is left?"
create or replace function public.app_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'member', exists (select 1 from public.desk_members where email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'trial',  (select to_jsonb(t) - 'stripe_customer' from public.trials t where t.email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'now',    now());
$$;
revoke all on function public.app_access() from public, anon;
grant execute on function public.app_access() to authenticated;

create or replace function public.has_trial_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trials
                  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
                    and (ends_at > now() or paid_until > now()));
$$;
revoke all on function public.has_trial_access() from public, anon;
grant execute on function public.has_trial_access() to authenticated;

-- 4. Picking a plan (works during and after the trial). It also puts a note on the Owner Desk's Requests list.
create or replace function public.choose_plan(p_plan text, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
  t  public.trials;
begin
  if p_plan not in ('family', 'home', 'facility', 'agency', 'group', 'nurse', 'reduced', 'more_time', 'not_now') then
    raise exception 'unknown plan';
  end if;
  update public.trials
     set plan = p_plan, plan_note = left(nullif(trim(p_note), ''), 1000), plan_chosen_at = now()
   where email = em
  returning * into t;
  if not found then return false; end if;
  insert into public.desk_items (kind, data) values ('request', jsonb_build_object(
    'kind', 'Action to take', 'biz', 'Trial: plan choice', 'when', 'This week', 'status', 'New', 'reply', '',
    'by', em, 'source', 'trial-plan', 'plan', p_plan,
    'text', em || ' picked "' || p_plan || '" (trial code ' || coalesce(t.code, '?') || ', trial ends ' || to_char(t.ends_at at time zone 'America/Chicago', 'Mon DD') || ').'
            || coalesce(E'\nTheir note: ' || t.plan_note, '')));
  return true;
end;
$$;
revoke all on function public.choose_plan(text, text) from public, anon;
grant execute on function public.choose_plan(text, text) to authenticated;

-- 5. Trial users may send ideas from the app chat and read their own notes and replies. Nothing else on the desk.
drop policy if exists "trial users send requests"      on public.desk_items;
drop policy if exists "trial users read own requests"  on public.desk_items;
create policy "trial users send requests" on public.desk_items for insert to authenticated
  with check (kind = 'request' and public.has_trial_access()
              and data ->> 'by' = lower(coalesce(auth.jwt() ->> 'email', '')) and data ->> 'only' is null);
create policy "trial users read own requests" on public.desk_items for select to authenticated
  using (kind = 'request' and public.has_trial_access()
         and data ->> 'by' = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 6. Owner Desk report: who redeemed, whether they confirmed their email, last sign-in.
create or replace function public.trial_report()
returns table (email text, code text, name text, home_type text, started_at timestamptz, ends_at timestamptz,
               plan text, plan_note text, plan_chosen_at timestamptz, paid_until timestamptz,
               confirmed boolean, last_sign_in timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.email, t.code, t.name, t.home_type, t.started_at, t.ends_at, t.plan, t.plan_note, t.plan_chosen_at, t.paid_until,
         u.email_confirmed_at is not null, u.last_sign_in_at
    from public.trials t
    left join auth.users u on lower(u.email) = t.email
   where public.is_desk_member()
   order by t.started_at desc;
$$;
revoke all on function public.trial_report() from public, anon;
grant execute on function public.trial_report() to authenticated;
