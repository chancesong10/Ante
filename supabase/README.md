# Supabase

Ante's backend is a hosted Supabase project. This directory exists so that the
schema, the row-level security policies, and the `delete_account()` function
live in version control instead of only in the dashboard.

## Status: captured

The live schema is committed as `migrations/20260918004851_baseline.sql`,
captured from the dashboard on 2026-09-18 and registered with
`supabase migration repair --status applied`, so local and remote migration
histories agree (`npx supabase migration list --linked` confirms).

See `SCHEMA_CONTRACT.md` for what each table owes the client, the verification
result, and four outstanding hardening items.

## Capturing the current schema

```bash
# 1. Authenticate (opens a browser)
npx supabase login

# 2. Link this directory to the hosted project.
#    The project ref is the subdomain of EXPO_PUBLIC_SUPABASE_URL in .env —
#    https://<ref>.supabase.co. You will be asked for the database password
#    (Dashboard -> Project Settings -> Database -> Database password).
npx supabase link --project-ref <ref>

# 3. Pull the schema into supabase/migrations/
npx supabase db pull

# 4. Commit what came back
git add supabase/migrations && git commit -m "Capture Supabase schema and RLS policies"
```

`db pull` writes a single baseline migration describing the current remote
state — tables, columns, constraints, functions, and policies.

### db pull requires Docker

`db pull` and `db dump` both build a throwaway shadow database in a container
to diff against, so both fail with `docker: command not found` on a machine
without Docker or Podman — even though the connection to the remote database
itself succeeds. Either install Docker Desktop, or use the dashboard route
below, which needs nothing installed.

### Capturing without Docker (or if the CLI can't authenticate)

Run `capture-schema.sql` from this directory in the dashboard SQL editor
(SQL Editor -> New query -> paste -> Run). It returns columns, constraints,
RLS state, policies, function definitions, triggers on both `public` and
`auth`, and role grants as one result set. Everything in it is a SELECT.

The individual queries, if you'd rather run them piecemeal:

```sql
-- tables and columns
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- RLS: is it on, and what are the policies?
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public';

-- the delete_account function, including security/search_path settings
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'delete_account';
```

## Verifying the result

`SCHEMA_CONTRACT.md` in this directory lists what the client code requires and
what to check on each table. Work through it once the pull lands — in
particular, confirm RLS is **enabled** on both tables. The anon key ships
inside the app binary and can be extracted from it, so RLS is the only thing
preventing one user from reading another's sessions. The `.eq('user_id', ...)`
filters in `services/syncService.js` narrow a query; they do not enforce
anything.

## Applying this to a fresh project

Once migrations are committed:

```bash
npx supabase link --project-ref <new-ref>
npx supabase db push
```

Then set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in
`.env` (see `.env.example`), and add the app's redirect URLs under
Authentication -> URL Configuration — `ante://` for the production scheme, plus
any dev-variant scheme.
