# What the client requires from the backend

Derived from the app source, not from the database. This is the checklist for
verifying whatever `supabase db pull` returns — it says what the client would
break without, and it is **not** a description of what production currently
has. Where the two disagree, production is the truth and this file is the bug
report.

Every line cites the code that depends on it.

## Table: `sessions`

Written by `services/syncService.js:6-18` (`toRow`).

| Column | Type the client implies | Why |
|---|---|---|
| `id` | `uuid`, primary key | `pushSessions` upserts with `onConflict: 'id'`. `context/SyncContext.js:6-16` filters to UUID-shaped ids precisely because this column is `uuid` — non-UUID legacy ids are kept local rather than remapped. |
| `user_id` | `uuid`, FK → `auth.users(id)`, on delete cascade | Every query filters on it. Cascade is what makes `delete_account()` remove sessions along with the user. |
| `game_type` | `text` | `session.gameType` |
| `mode` | `text` | `'hands'` or `'buyInCashOut'` |
| `start_time` | `timestamptz` | Written as ISO; `pullSessions` orders by it descending (`syncService.js:41-44`). |
| `end_time` | `timestamptz` | Written as ISO. |
| `net_profit` | `numeric` | Defaults to `0` client-side when absent. |
| `data` | `jsonb` | The full session record. **This is the only column read back** — `pullSessions` selects `data` alone, so the scalar columns above exist for querying and integrity, not for hydration. |

Operations the client performs:

- `upsert(rows, { onConflict: 'id' })` — insert **and** update
- `select('data').eq('user_id', userId).order('start_time', desc)`
- `delete().eq('user_id', userId).in('id', sessionIds)`

So the policies must permit `select`, `insert`, `update`, and `delete` for the
owning user.

### RLS checklist

- [ ] RLS is **enabled** on the table (not just policies defined — a table with
      policies but RLS off enforces nothing)
- [ ] `select` policy restricted to `auth.uid() = user_id`
- [ ] `insert` policy with `with_check (auth.uid() = user_id)` — without the
      `with_check`, a caller can insert rows owned by someone else
- [ ] `update` policy with **both** `using` and `with_check` on
      `auth.uid() = user_id` — `using` alone allows reassigning a row to
      another user
- [ ] `delete` policy restricted to `auth.uid() = user_id`
- [ ] No policy grants the `anon` role anything

## Table: `profiles`

| Column | Type the client implies | Why |
|---|---|---|
| `id` | `uuid`, primary key, FK → `auth.users(id)` | `context/AuthContext.js:79-84` selects by it with `.single()`. |
| `username` | `text` | Read on load; written by `updateUsername` (`AuthContext.js:215-223`). |
| `email` | `text` | Read on load. |
| `updated_at` | `timestamptz` | Written by `updateUsername`. |

`fetchProfile` uses `.single()`, which **errors when no row exists**. So a row
must be created for every new user — normally an `on auth.users` insert trigger.
Confirm that trigger exists; without it, the first load after signup logs
`AuthContext: failed to load profile` and `profile` stays null.

### RLS checklist

- [ ] RLS enabled
- [ ] `select` restricted to `auth.uid() = id`
- [ ] `update` with `using` and `with_check` on `auth.uid() = id`
- [ ] Insert handled by the signup trigger (`security definer`), not by a
      permissive client-facing insert policy

## Function: `delete_account()`

Called with no arguments from `context/AuthContext.js:259`. The comment above
that call already points here: *"the anon key can't touch `auth.users`
directly."*

- [ ] Exists in the `public` schema, callable by `authenticated`
- [ ] `security definer` — it has to delete from `auth.users`, which the
      caller's role cannot
- [ ] `set search_path = ''` (or an explicit safe schema list). A `security
      definer` function without a pinned `search_path` is the classic
      privilege-escalation hole: a caller who can create objects in a schema
      earlier on the path can shadow a function the body calls.
- [ ] Derives the user from `auth.uid()` internally and takes **no** user id
      parameter — a parameter would let any authenticated caller delete any
      account
- [ ] Not granted to `anon`

## Auth configuration (dashboard, not captured by `db pull`)

- [ ] Redirect allowlist contains the app scheme — `ante://`. `AuthContext.js:10`
      derives it from `Linking.createURL('')`, so it follows `scheme` in
      `app.json`. A dev build with a different scheme needs its own entry.
- [ ] Google provider configured (used by `signInWithGoogle`)
- [ ] Email confirmations on, since the deep-link handler at `AuthContext.js:113-117`
      exists to catch confirmation links
