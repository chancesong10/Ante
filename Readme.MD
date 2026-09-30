<p align="center">
  <img src="./assets/logo_transparent.png" width="120" alt="Ante logo" />
</p>

<h1 align="center">Ante</h1>

<p align="center">
  <b>The bankroll tracker that tells you the truth about your gambling.</b><br/>
  Live session tracking, a real analytics engine, and a leak detector that names<br/>
  the habit costing you money — for Blackjack, Poker, Sports Betting, Roulette, Baccarat, and everything else.
</p>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-iOS%20%7C%20Android-3B2F28" />
  <img alt="status" src="https://img.shields.io/badge/status-Google%20Play%20closed%20testing-B8472A" />
  <img alt="tests" src="https://img.shields.io/badge/tests-363%20passing-2A734A" />
</p>

---

## Why Ante exists

Ask any regular gambler how they're doing lifetime and you'll get a vibe, not a number. Memory overweights the one big win from three months ago and quietly erases the twenty small losses that got you there.

The house doesn't have that problem. Casinos and sportsbooks know your exact numbers, down to the cent. You don't.

**Ante is the ledger for the other side of the table.** Log every hand, every bet, every buy-in and cash-out as it happens — and let the app do the arithmetic your brain is bad at.

It never touches real money, never places a wager, and has no connection to any casino or sportsbook. It's a notebook with a statistician built in.

## What it does

### Six purpose-built trackers

Every game gets a tracker shaped around how that game actually works, rather than one generic form with the labels swapped.

| | What you log |
|---|---|
| **Blackjack** | Bet size with tap-to-add chips, doubles, splits, naturals, insurance, surrender. Optional **card-level mode** records the upcard, your two cards, and your first action, then grades the play against basic strategy for the table's rules |
| **Poker** | Per-street, per-player betting with a derived pot — see below |
| **Sports Betting** | Matchup, bet type, American odds, auto-calculated payout, and **pending bets** that stay open until they settle |
| **Roulette** | Straight up, split, street, corner, dozen, column, or an even-money outside bet, on a single- or double-zero wheel, with the correct odds applied automatically |
| **Baccarat** | Player, Banker, or Tie, with the 5% Banker commission and your table's Tie payout applied automatically |
| **General** | Buy-in and cash-out for slots, craps, a home game — anything without a template |

Every tracker has an illustrated guide behind the ⓘ in its header.

### Run several at once

A blackjack session lasts an evening. A sports slip can sit unsettled for three days. Ante runs **one live session per game**, all at the same time, so a pending parlay never blocks you from logging a poker night. Live sessions survive the app being closed or killed by the phone, and time spent away doesn't count toward session length.

### Poker, done properly

Poker math is the hardest to reconstruct from memory, so it gets the deepest tracker. Set the table size and the blinds in play, then every hand walks Pre-Flop → Flop → Turn → River → Showdown:

- A bet card for you **and every other player**, renameable and remembered for the session
- Quick-chips include your actual **SB** and **BB**, so posting a blind is one tap
- **Call** on every card, greyed out until there's a bet to match
- Fold anyone mid-street — their money stays in the pot as dead money, and it's reversible
- The pot is **fully derived** from what's been entered; nothing to babysit
- You can't advance a street with mismatched bets — Ante blocks it and shows who owes what

At Showdown, mark it Won / Split / Lost and Ante works out your net, N-way chops included.

### The leak detector

Ante doesn't just total your losses — it names the *pattern* costing you money, and tells you what it costs.

- **Loss chasing** — betting measurably bigger after a loss than after a win
- **Bluff catching** — how often you folded the best hand, and the pot you left behind
- **Tilt index** — whether getting bluffed changes how you play the very next hand
- **Odds edge** — your real win rate against the price the book actually gave you
- **Strategy accuracy** — how often your blackjack decisions match basic strategy, your most common mistakes, and what 6:5 tables are costing you
- **House edge check** — your roulette and baccarat results against the math
- **Session fatigue**, **volatility**, **conditional win rates**, **bet-tier drop-off**, **bb/100**, and day-of-week, time-of-day, and session-length patterns

Every finding carries its sample size, so you know when to trust it. Patterns surface on as few as three or four hands — a finding that thin is a signal to watch, not a verdict.

### History and analytics

Every finished session lands in History — filterable, expandable to a hand-by-hand breakdown, swipe to delete. Analytics rolls it into a lifetime view: net outcome, total wagered, win rate, a bankroll-over-time chart, best and worst sessions, profit factor, hourly rate, and a per-game breakdown showing which game is actually making or costing you money. Export everything to CSV any time.

Privacy mode masks every recorded figure — in neutral colour, so a green or red number can't give the result away — when someone's looking over your shoulder.

### Responsible gaming, not a checkbox

Set a stop-loss threshold and Ante interrupts a live session that crosses it — full screen, with your live net, duration, hand count, a one-tap **End Session**, and the National Council on Problem Gambling helpline.

Alerts are **tiered**: dismissing one only silences it until your losses deepen past the *next* threshold, so it can't be swiped away and forgotten. With several sessions running, each is watched independently — a quiet table can't mask a bad one.

### Design

Paper and ink. Cream pages, cocoa text, and a few soft pastels that each carry one meaning — sage for money won, berry for money lost, butter for a warning, tomato for the brand's one accent. Figtree for text, with true tabular figures so money columns line up, and Fraunces for titles, so a page feels like a notebook rather than a dashboard.

A warm-charcoal dark theme is the same room with the lights down. **Profile → Appearance** switches between Light, Dark, and Match phone, and native pieces like the Ante+ paywall, alerts, and keyboard follow the app's choice rather than the phone's. Every text colour passes WCAG AA contrast on every surface, in both themes, and screen readers get real labels throughout.

## Ante+

Tracking is free. **Ante+** unlocks the behavioural layer — the leak detector, conditional win rates, streak analysis, strategy grading, and every insights page, plus lifetime cross-game patterns.

Available monthly, annually, or as a one-time lifetime purchase. Billed through the App Store or Google Play; cancel any time from your store account. Ante+ requires an account, so the purchase follows you to a new phone.

## Your data

Ante is **local-first**. Everything works fully offline, and an account is optional.

- **No account?** Your sessions live on your device and go nowhere else.
- **Signed in?** Completed sessions also sync to your account so they survive a new phone. Live sessions stay on-device.
- **Delete your account** from inside the app, or by email if you can't sign in.
- **No third-party analytics or ad tracking** is embedded in the app.
- Subscription status is handled by RevenueCat; the payment itself is processed by Apple or Google, and card details never reach us.

Full detail in the [Privacy Policy](https://anteapp.github.io/privacy-policy.html) and [Terms of Service](https://anteapp.github.io/terms-of-service.html).

## What's next

Deeper poker analytics with position-aware stats, bankroll goals and budgeting beyond the stop-loss alert, home-screen widgets showing live session net, and biometric app lock for shared devices.

---

## For developers

### Stack

| Layer | Technology |
|---|---|
| App | React Native 0.86, React 19, Expo SDK 57, React Navigation 7 |
| State | React Context, split into a hot path (the live session) and a cold path (history) so background screens don't re-render on every hand |
| Storage | AsyncStorage, local-first; auth tokens encrypted with AES-256-CTR, key held in Keychain / Keystore |
| Backend | Supabase — Postgres, Auth (email + Google OAuth with PKCE), row-level security on every table |
| Payments | RevenueCat (`react-native-purchases`, RevenueCat Paywalls) |
| Quality | Jest (363 tests, 21 suites), ESLint 9, GitHub Actions on every push and PR |
| Release | EAS Build, EAS Update, Google Play Console |

### Project layout

```
screens/      One file per screen: six trackers, insights pages, history, analytics, profile
components/   Shared UI: modals, charts, tracker guides, paywall gate, consent gate, error boundary
context/      Auth, sessions, sync, purchases, preferences, theme
services/     Storage, Supabase client and sync, RevenueCat
utils/        Pure-JS analytics engines and hand math — no React, fully unit-tested
constants/    Theme palettes, fonts, layout scale, game definitions, legal text (the single source)
supabase/     Version-controlled schema and migrations; SCHEMA_CONTRACT.md documents what the client relies on
scripts/      Env sync to EAS, legal-doc generation, third-party license notices
docs/         GitHub Pages site: privacy policy, terms, account-deletion page
legal/        Generated Markdown copies of the policies and license notices
```

The statistics all live in `utils/` as plain functions over session history, so they can be tested without React Native. History is never mutated in place, which is what makes the `WeakMap` caches in the engines safe.

### Running it

```bash
npm install
cp .env.example .env    # then fill in the three keys below
npx expo start          # needs a development build, not Expo Go
```

| Variable | What it's for |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe to ship — RLS is the security boundary) |
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | RevenueCat public SDK key |

Without the Supabase keys the app runs as guest-only; without the RevenueCat key Ante+ stays locked. Neither crashes.

A development build is needed because the app uses native modules (RevenueCat, SecureStore). Make one with `eas build --profile development --platform android`, or run `npm run android` with Android Studio installed.

### Scripts

| Command | What it does |
|---|---|
| `npm test` | Run the Jest suite |
| `npm run lint` | ESLint over the whole project |
| `npm run env:sync` | Push the `EXPO_PUBLIC_*` keys from `.env` to EAS, without printing them. `.env` is gitignored, so cloud builds only get the keys this way |
| `npm run legal:build` | Regenerate the Markdown and HTML policies from `constants/legal.js` |
| `npm run legal:notices` | Regenerate `THIRD_PARTY_NOTICES.md` from the production dependency tree |

### Releasing

There are two kinds of release.

**A new store build** — needed for anything native: a new native package, a change to `app.json` plugins, the splash screen, or the icon.

```bash
eas build --platform android --profile production
```

The version code increments automatically. Upload the `.aab` to Play Console.

**An over-the-air update** — for JavaScript and asset changes only. No store review, no reinstall.

```bash
eas update --channel production --message "What changed"
```

The app checks on launch, downloads in the background, and runs the update the next time it's opened. Builds use a fingerprint runtime version, so an update only reaches builds with matching native code; one that needs a new native build waits for it instead of crashing older installs. Channels are `development`, `preview`, and `production`, one per build profile.

The Android and iOS folders are gitignored and generated at build time from `app.json`, so native config belongs there rather than in `android/`.

### Backend

The Supabase schema, RLS policies, and the `delete_account()` function are in `supabase/migrations/`. See [`supabase/README.md`](supabase/README.md) for linking and pulling, and [`SCHEMA_CONTRACT.md`](supabase/SCHEMA_CONTRACT.md) for what each table owes the client.

---

## Responsible gambling

Ante is a **tracking and analytics tool only**. It does not facilitate, process, or place any real-money wager, and has no relationship with any casino, sportsbook, or gambling operator. You must be 18 or older to use it.

If gambling stops being fun, the National Council on Problem Gambling runs a free, confidential 24/7 helpline: **1-800-522-4700**. Outside the US, please look up your local equivalent. Track honestly, and stop when the numbers tell you to.

---

<p align="center">
  <sub><a href="mailto:tncante1008@gmail.com">tncante1008@gmail.com</a></sub>
</p>
