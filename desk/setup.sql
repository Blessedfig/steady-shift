-- Owner Desk database setup for Supabase.
-- Paste this whole file into Supabase > SQL Editor > New query, change the two emails
-- at the bottom, and press Run. Running it again is safe.
--
-- What it does:
--   desk_members  : the list of email addresses allowed into the desk. Nobody can read it from the web.
--   desk_items    : leads, next steps and notes. Only signed-in people on desk_members can read or change them.
-- Visitors who are not signed in, or signed in with an email not on the list, see nothing.

create table if not exists public.desk_members (
  email text primary key check (email = lower(email))
);
alter table public.desk_members enable row level security;
revoke all on public.desk_members from anon, authenticated;

create or replace function public.is_desk_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.desk_members
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_desk_member() from public, anon;
grant execute on function public.is_desk_member() to authenticated;

create table if not exists public.desk_items (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('lead', 'milestone', 'note', 'request')),
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text default lower(auth.jwt() ->> 'email')
);
alter table public.desk_items enable row level security;
revoke all on public.desk_items from anon;
grant select, insert, update, delete on public.desk_items to authenticated;

drop policy if exists "desk members can read"   on public.desk_items;
drop policy if exists "desk members can add"    on public.desk_items;
drop policy if exists "desk members can change" on public.desk_items;
drop policy if exists "desk members can remove" on public.desk_items;

create policy "desk members can read"   on public.desk_items for select to authenticated using (public.is_desk_member());
create policy "desk members can add"    on public.desk_items for insert to authenticated with check (public.is_desk_member());
create policy "desk members can change" on public.desk_items for update to authenticated using (public.is_desk_member()) with check (public.is_desk_member());
create policy "desk members can remove" on public.desk_items for delete to authenticated using (public.is_desk_member());

-- Who may use the desk. Replace these with real addresses (lowercase), then Run.
-- To add someone later, run just one more line like these.
insert into public.desk_members (email) values
  ('first-person@example.com'),
  ('second-person@example.com')
on conflict do nothing;

-- Allow "Requests for Claude" items on a desk set up before they existed.
alter table public.desk_items drop constraint if exists desk_items_kind_check;
alter table public.desk_items add constraint desk_items_kind_check check (kind in ('lead', 'milestone', 'note', 'request'));
