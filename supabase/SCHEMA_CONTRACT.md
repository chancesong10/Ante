# What the client requires from the backend

Derived from the app source, then **verified against the live database on
2026-09-18**. The captured state is committed as
`migrations/20260918004851_baseline.sql`.

Every line cites the code that depends on it.

## Verification result: sound, and since hardened

All four items that would have been serious were correct as found:

- RLS is **enabled** on both tables, not merely policied
- The insert policy has `with check`, so a caller cannot insert rows owned by
  someone else
- Both update policies have `using` **and** `with check`, so a caller cannot
  reassign a row to another user
- `delete_account()` is `security definer` with `search_path` pinned to `''`,
  takes no parameters, and derives the user from `auth.uid()`

Four hardening items found alongside them have since been applied; see below.

## Table: `sessions`

Written by `services/syncService.js` (`toRow`).

| Column | Live type | Why the client needs it |
|---|---|---|
| `id` | `uuid` not null, PK | `pushSessions` upserts with `onConflict: 'id'`. `context/SyncContext.js:6-16` filters to UUID-shaped ids precisely because this column is `uuid`. |
| `user_id` | `uuid` not null, FK → `auth.users(id)` on delete cascade | Every query filters on it. |
| `game_type` | `text` not null | `session.gameType` |
| `mode` | `text` not null, `check in ('buyInCashOut','hands')` | Matches the two shapes `finalizeSession` produces. **A third mode would be rejected by the database** — update this constraint alongside any new mode. |
| `start_time` | `timestamptz` not null | `pullSessions` orders by it descending. |
| `end_time` | `timestamptz` not null | |
| `net_profit` | `numeric` not null default `0` | |
| `data` | `jsonb` not null | The full record, and **the only column read back** — `pullSessions` selects `data` alone. The scalar columns exist for querying and integrity, not hydration. |
| `created_at` | `timestamptz` not null default `now()` | Not read by the client. |

- [x] RLS enabled
- [x] `sessions_select_own` — `using (auth.uid() = user_id)`
- [x] `sessions_insert_own` — `with check (auth.uid() = user_id)`
- [x] `sessions_update_own` — `using` and `with check`
- [x] `sessions_delete_own` — `using (auth.uid() = user_id)`

## Table: `profiles`

| Column | Live type | Why the client needs it |
|---|---|---|
| `id` | `uuid` not null, PK, FK → `auth.users(id)` on delete cascade | `AuthContext.js:79-84` selects by it with `.single()`. |
| `username` | `text` not null default `'Ante Highroller'` | Read on load; written by `updateUsername`. |
| `email` | `text` not null | Read on load. |
| `created_at` | `timestamptz` not null default `now()` | Not read by the client. |
| `updated_at` | `timestamptz` not null default `now()` | Written by `updateUsername`. |

- [x] RLS enabled
- [x] `profiles_select_own` — `using (auth.uid() = id)`
- [x] `profiles_update_own` — `using` and `with check`
- [x] Row creation handled by the `on_auth_user_created` trigger on
      `auth.users`, which runs `handle_new_user()` (`security definer`). This
      is what makes `fetchProfile`'s `.single()` safe — **it is load-bearing,
      not incidental.** Without it the first load after signup fails.

## Function: `delete_account()`

- [x] Exists in `public`, no parameters
- [x] `security definer`
- [x] `set search_path to ''`
- [x] Derives the user from `auth.uid()` internally
- [x] Raises `28000` when `auth.uid()` is null, rather than silently deleting
      nothing and reporting success — which would sign someone out believing
      their account was gone
- [x] Deletes `sessions`, then `profiles`, then `auth.users`, explicitly
      rather than trusting cascade

## Hardening applied

All four items are done, in `migrations/20260918014500_harden_grants_and_signup.sql`.
None was exploitable as the app stood; each closed a gap that would only
matter once something else changed.

- [x] **`anon` grants revoked** on both tables. Supabase grants `all` to
      `anon` by default and RLS neutralised it, but the app never touches
      either table as `anon`, so the grant bought nothing — and it included
      `truncate`, the one privilege RLS does not govern. `truncate` is also
      revoked from `authenticated`.
- [x] **Policies scoped to `authenticated`** rather than `public`.
- [x] **`handle_new_user()` pins `search_path` to `''`**, matching
      `delete_account()`, with every reference schema-qualified to suit.
- [x] **Signup survives a null email.** `profiles.email` is `not null` and
      the trigger inserted `new.email` directly, so a provider yielding no
      address failed the insert — and an `after insert` trigger failure
      aborts the whole signup transaction. It now falls back to an empty
      string, and the username falls back past a blank local-part to the
      column default.

### Not captured: indexes

The dashboard query in `capture-schema.sql` reads constraints, not indexes, so
index coverage is unverified. `pullSessions` filters on `user_id` and orders by
`start_time` — and Postgres does **not** create an index for a foreign key
automatically. Worth checking:

```sql
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' order by tablename;
```

If there's nothing covering `user_id`, `create index on public.sessions
(user_id, start_time desc);` matches the query exactly. Irrelevant at current
row counts; cheap to add before it isn't.

## Auth configuration (dashboard, not captured by a schema dump)

- [ ] Redirect allowlist contains the app scheme — `ante://`. `AuthContext.js:10`
      derives it from `Linking.createURL('')`, so it follows `scheme` in
      `app.json`. A dev build with a different scheme needs its own entry.
- [x] Google provider configured (`signInWithGoogle` works)
- [x] Email confirmations on (the deep-link handler at `AuthContext.js:113-117`
      exists to catch confirmation links)
