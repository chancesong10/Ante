-- Baseline: the schema as it existed in the hosted project on 2026-09-18.
--
-- Captured from the dashboard rather than `supabase db pull`, which needs
-- Docker (see ../README.md). Transcribed from the live database, so it
-- describes what IS, not what should be — hardening recommendations are
-- deliberately NOT folded in here, so that this file can be diffed against
-- production and match.
--
-- This migration is already applied to the linked project. Register it as
-- such before running anything else, or the CLI will try to re-apply it:
--
--   npx supabase migration repair --status applied 20260918004851
--
-- Two things present in the live database are intentionally omitted:
--
--   * The `rls_auto_enable()` event trigger, which auto-enables RLS on newly
--     created public tables. It is Supabase platform infrastructure, needs
--     superuser to create, and already exists on any Supabase project.
--   * The default `grant all on <table> to anon, authenticated, service_role`
--     that Supabase applies to tables in the public schema. A fresh project
--     applies these itself. They are recorded in ../SCHEMA_CONTRACT.md, along
--     with why the anon half of them is worth revoking.

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id         uuid        not null primary key
                         references auth.users (id) on delete cascade,
  username   text        not null default 'Ante Highroller'::text,
  email      text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

-- Both `using` and `with_check`: `using` alone would let a caller reassign a
-- row to another user.
create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert policy by design — rows are created by handle_new_user() below,
-- which is security definer and so bypasses RLS. No delete policy either;
-- delete_account() is likewise security definer.

-- ---------------------------------------------------------------- sessions

create table if not exists public.sessions (
  id         uuid        not null primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  game_type  text        not null,
  mode       text        not null,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  net_profit numeric     not null default 0,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  constraint sessions_mode_check
    check (mode = any (array['buyInCashOut'::text, 'hands'::text]))
);

alter table public.sessions enable row level security;

create policy sessions_select_own
  on public.sessions for select
  using (auth.uid() = user_id);

create policy sessions_insert_own
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy sessions_update_own
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy sessions_delete_own
  on public.sessions for delete
  using (auth.uid() = user_id);

-- --------------------------------------------------------------- functions

-- Creates the profiles row at signup. AuthContext.fetchProfile reads it with
-- .single(), which errors when no row exists, so this trigger is load-bearing
-- for the first launch after signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$function$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called with no arguments from context/AuthContext.js. Security definer
-- because the anon key cannot touch auth.users directly; `search_path` is
-- pinned to '' so nothing in the body can be shadowed by an attacker-created
-- schema earlier on the path.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
begin
  -- auth.uid() is null for an anon/expired token. Without this check the
  -- deletes below would silently match nothing and the function would report
  -- success, so the app would sign someone out believing it had deleted them.
  if uid is null then
    raise exception 'delete_account: no authenticated user'
      using errcode = '28000';
  end if;

  -- Explicit rather than relying on ON DELETE CASCADE, so this stays correct
  -- whether or not those foreign keys were declared with it.
  delete from public.sessions where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$function$;
