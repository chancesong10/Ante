-- Run this in the Supabase dashboard SQL editor:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
-- Then copy the whole result and hand it back, and it becomes the baseline
-- migration in supabase/migrations/.
--
-- This exists because `supabase db pull` and `db dump` both shell out to
-- Docker (they build a shadow database to diff against), and Docker is not
-- installed on this machine. Read-only: every statement below is a SELECT.

with cols as (
  select
    format('COLUMN   %s.%s  %s  nullable=%s  default=%s',
           table_name, column_name, data_type, is_nullable,
           coalesce(column_default, '-')) as line,
    1 as ord, table_name as k1, ordinal_position as k2
  from information_schema.columns
  where table_schema = 'public'
),
constraints as (
  select
    format('CONSTRAINT %s on %s: %s',
           conname, conrelid::regclass::text, pg_get_constraintdef(oid)) as line,
    2 as ord, conrelid::regclass::text as k1, 0 as k2
  from pg_constraint
  where connamespace = 'public'::regnamespace
),
rls as (
  select
    format('RLS      %s  enabled=%s', relname, relrowsecurity) as line,
    3 as ord, relname as k1, 0 as k2
  from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'
),
pol as (
  select
    format('POLICY   %s.%s  cmd=%s  permissive=%s  roles=%s  using=%s  check=%s',
           tablename, policyname, cmd, permissive, roles::text,
           coalesce(qual, '-'), coalesce(with_check, '-')) as line,
    4 as ord, tablename as k1, 0 as k2
  from pg_policies
  where schemaname = 'public'
),
fns as (
  select
    format('FUNCTION %s', pg_get_functiondef(p.oid)) as line,
    5 as ord, p.proname as k1, 0 as k2
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
-- Triggers on auth.users matter as much as anything in public: the profile
-- row that AuthContext.fetchProfile expects via .single() is normally created
-- by one of these at signup.
trg as (
  select
    format('TRIGGER  %s', pg_get_triggerdef(t.oid)) as line,
    6 as ord, c.relname as k1, 0 as k2
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and n.nspname in ('public', 'auth')
),
grants as (
  select
    format('GRANT    %s on %s to %s', privilege_type, table_name, grantee) as line,
    7 as ord, table_name as k1, 0 as k2
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
)
select line from (
  select * from cols
  union all select * from constraints
  union all select * from rls
  union all select * from pol
  union all select * from fns
  union all select * from trg
  union all select * from grants
) x
order by ord, k1, k2;
