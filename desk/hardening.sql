-- Optional security hardening for the Owner Desk database (Supabase project "owner-desk").
-- Christian runs this once: Supabase > SQL Editor > New query > paste > Run. Running it again is safe.
-- Nothing here changes what people can see. It adds two safeguards that auditors and HIPAA reviews expect:
--   1. "Who changed this" is always stamped by the database, so it cannot be typed in or faked from a browser.
--   2. An append-only activity log of every add, change and removal (who, when, which item). Nobody can edit
--      or delete log rows from the web, and it never copies the item's contents.

-- 1. Server-side stamps
create or replace function public.desk_items_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := lower(coalesce(auth.jwt() ->> 'email', 'system'));
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; new.id := old.id; end if;
  return new;
end;
$$;
drop trigger if exists desk_items_stamp on public.desk_items;
create trigger desk_items_stamp before insert or update on public.desk_items
  for each row execute function public.desk_items_stamp();

-- 2. Append-only activity log
create table if not exists public.desk_audit (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text,
  action  text not null,
  item_id uuid,
  kind    text
);
alter table public.desk_audit enable row level security;
revoke all on public.desk_audit from anon, authenticated;
grant select on public.desk_audit to authenticated;
drop policy if exists "desk members can read the log" on public.desk_audit;
create policy "desk members can read the log" on public.desk_audit for select to authenticated using (public.is_desk_member());

create or replace function public.desk_items_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.desk_audit (actor, action, item_id, kind)
  values (lower(coalesce(auth.jwt() ->> 'email', 'system')), lower(tg_op),
          coalesce(new.id, old.id), coalesce(new.kind, old.kind));
  return null;
end;
$$;
drop trigger if exists desk_items_log on public.desk_items;
create trigger desk_items_log after insert or update or delete on public.desk_items
  for each row execute function public.desk_items_log();
