-- Hardening pass (issue #25). None of this was exploitable as the app stood;
-- it closes gaps that only matter once something else changes.

-- 1. Revoke anon's grants on both tables ------------------------------------
--
-- Supabase grants `all` on public-schema tables to anon, authenticated and
-- service_role by default. RLS neutralises that for anon, since auth.uid() is
-- null on an anon token and every policy evaluates false — but the app never
-- reads or writes either table as anon (sync only runs with a userId, the
-- profile query only with a session), so the grant buys nothing.
--
-- `truncate` is the one that actually matters: RLS does not govern it. There
-- is no route to truncate through PostgREST today, so this is defence in
-- depth rather than a fix, but the privilege should not exist at all.
revoke all on public.sessions from anon;
revoke all on public.profiles from anon;

-- authenticated keeps the CRUD it needs, bounded by RLS, but has no business
-- truncating either table.
revoke truncate on public.sessions from authenticated;
revoke truncate on public.profiles from authenticated;

-- 2. Scope the policies to authenticated ------------------------------------
--
-- All six were `to public`, which includes anon. Safe in practice for the
-- auth.uid() reason above, but the intent reads better — and fails safer —
-- when it is stated.
alter policy sessions_select_own on public.sessions to authenticated;
alter policy sessions_insert_own on public.sessions to authenticated;
alter policy sessions_update_own on public.sessions to authenticated;
alter policy sessions_delete_own on public.sessions to authenticated;
alter policy profiles_select_own on public.profiles to authenticated;
alter policy profiles_update_own on public.profiles to authenticated;

-- 3. handle_new_user: pin search_path, and survive a null email -------------
--
-- Two changes.
--
-- search_path moves from 'public' to '', matching delete_account(). The body
-- only calls coalesce and split_part, both resolved from pg_catalog which is
-- always searched first, so there was no shadowing route — but the two
-- functions should not teach different lessons to whoever writes the third.
-- Every reference below is schema-qualified to suit the empty path.
--
-- The email fallback is the real fix. profiles.email is NOT NULL and the
-- trigger inserted new.email directly, so an auth provider that yields no
-- address failed the insert — and because this is an AFTER INSERT trigger on
-- auth.users, that failure aborts the whole signup transaction. The user
-- cannot create an account at all, and it surfaces as a generic signup
-- error rather than anything pointing at a trigger. Google and email/password
-- both always supply an address, so this was latent; it would have gone live
-- the day Apple Sign-In with private relay, phone auth, or any provider with
-- the email scope withheld was added.
--
-- The empty-string fallback keeps the NOT NULL constraint meaningful (the
-- column stays non-null) while letting signup complete. The app reads
-- profile.email for display only, and AuthContext already tolerates a blank
-- one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'username',
      nullif(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), ''),
      'Ante Highroller'
    )
  );
  return new;
end;
$function$;
