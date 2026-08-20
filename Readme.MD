<p align="center">
  <img src="./assets/logo_transparent.png" width="120" alt="Ante logo" />
</p>

<h1 align="center">Ante</h1>

<p align="center">
  <b>The bankroll tracker that tells you the truth about your gambling.</b><br/>
  Live session tracking, a real analytics engine, and behavioral insights — for Blackjack, Poker, Sports Betting, and anything else you'd throw money at.
</p>

<p align="center">
  <img alt="platform" src="https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-3B82F6" />
  <img alt="status" src="https://img.shields.io/badge/status-active%20development-10B981" />
</p>

---

## The problem

Ask any regular gambler how they're doing lifetime and you'll get a vibe, not a number. Memory overweights the one big win from three months ago and quietly erases the twenty small losses that got you there. Casinos and sportsbooks know your exact numbers, down to the cent. You don't.

**Ante is the ledger for the other side of the table.** Log every hand, every bet, every buy-in and cash-out, in real time — and let the app do the arithmetic your brain is bad at: net result, win rate, variance, and whether your own habits are actually working for you or against you.

It's not a betting app. It never touches real money, never places a wager, and never talks to a sportsbook or casino. It's a notebook with a statistician built in.

## What it does

### Live session tracking, per game

Tap **Start a Session**, pick a game, and log as you play. Every game gets a purpose-built tracker instead of a generic form:

| Game | What you track |
|---|---|
| 🂡 **Blackjack** | Bet size (with tappable quick-chips), double down, natural blackjack, split hands, win/loss/push |
| 🃏 **Poker** | Full per-street, per-player betting — see below |
| 🏀 **Sports Betting** | Matchup, bet type (Moneyline / Spread / Total), American odds, auto-calculated payout, win/loss/push |
| 🎲 **General** | Simple buy-in / cash-out for anything else — slots, craps, a home game, whatever doesn't fit a template |

Every tracker shares the same live session experience: a running net-outcome banner, hand/bet counters, swipe-to-delete on any logged entry, and a single **End Session** action that commits the session to history and updates your lifetime stats.

### Poker, done properly

Poker is the deepest tracker in the app, because poker math is the hardest to reconstruct from memory. Setup asks two things before you deal a single hand:

1. **How many players are at the table** (2–10, including you).
2. **What blinds are live** — no blinds, big blind only, or small + big blind, typed in as whatever stakes you're actually playing.

From there, every hand walks through Pre-Flop → Flop → Turn → River → Showdown. On each betting street:

- **You get a bet card, and so does every other player at the table** — optionally renamed from "Player 1, 2, 3…" to real names, remembered for the rest of the session.
- Quick-chip buttons include your **SB** and **BB** amounts alongside your own custom denominations, so posting a blind or a standard raise is one tap.
- A **Call** button sits on every player's card, always visible, greyed out until there's actually a bet to match — tap it to instantly match the table's current high bet.
- Anyone can be **folded** mid-street; their last-entered bet stays counted as dead money in the pot, and folding is reversible if you tap it by mistake.
- The pot is **fully derived** from what's actually been entered — no manual pot override, no separate player counter to babysit.
- You can't advance to the next street with mismatched bets among players still in the hand — Ante checks and blocks you with a clear breakdown of who owes what, instead of letting a hand's math quietly go wrong.

At Showdown, mark the hand as **Won / Split / Lost** and Ante calculates your net result — including N-way chops — automatically.

### Session history

Every completed session lands in **History** — filterable by All / Wins / Losses, sorted newest-first, swipe-to-delete with a clean confirmation. Tap a session to expand its full breakdown: buy-in/cash-out or hand-by-hand record, win/loss/push counts, and duration.

### Analytics dashboard

The **Analytics** tab rolls every session you've ever logged into one lifetime view: net outcome, total wagered, win rate, hands/bets logged, best and worst single session, average session net, and a **profit factor** (gross wins ÷ gross losses — the same metric professional traders use to judge whether a strategy is actually working). Privacy mode masks every dollar figure with dots when someone's looking over your shoulder.

### Behavioral insights engine

This is Ante's real edge. Once you've logged at least 5 hands of a given game, an **Insights** screen unlocks statistics most players never get real numbers for:

- **Conditional win rates** — your actual win rate after a win, after a loss, after two in a row of either. Real transition probabilities, with sample size shown so you know when to trust them.
- **Loss-chasing detection** — flags it when you're measurably betting bigger after a loss than after a win.
- **Doubling performance** (Blackjack) — win rate and ROI specifically on hands where you doubled down.
- **Natural blackjack frequency** — your actual blackjack rate vs. the statistical baseline (4.8%), a quick luck-vs-skill check.
- **Win rate by bet-size tier** — splits your betting history into thirds based on *your own* range and shows win rate per tier.
- **Volatility / consistency score** — a 0–100 read on how consistent your bet-sizing and results actually are.
- **Best/worst day of week** and **performance by session length** — pattern detection across time that's essentially impossible to track by memory.

### Vault profile & preferences

The **Profile** tab is your lifetime dashboard: net outcome, total wagered, win rate, and bets logged across everything, plus a per-game breakdown so you can see which game is actually making or costing you money. From here you can also adjust currency, toggle privacy mode and quick-chip buttons, export your full history, or wipe it clean.

### Responsible gaming, built in

Ante includes an opt-in **stop-loss alert**: set a dollar threshold, and if a live session's net result crosses it, a full-screen alert interrupts play with your live outcome, session duration, hand count, an **End Session & Protect Bankroll** action, and a direct line to the National Council on Problem Gambling helpline. Alerts are tiered — dismissing one only silences it until your losses deepen *further* past the next threshold, so it can't be swiped away and forgotten. This isn't a checkbox feature; it's core to the product.

### Design

A dark "midnight sportsbook" theme — deep navy backgrounds, electric blue/cyan accents, green strictly reserved for wins — fully responsive from a small phone to a tablet. Every confirmation and warning in the app uses a custom-designed dialog matching Ante's own visual language, not a generic OS popup, down to swipe-to-delete gestures that animate smoothly instead of snapping.

## Your data stays yours

Everything Ante tracks lives on your device — there's no account required and no third-party analytics or ad tracking inside the app. You can export your full session history at any time, or wipe it completely, from **Profile → Data Vault**. Today's local-first data is designed to carry forward cleanly into optional cloud sync down the line, without you losing anything or needing to redo it.

## Try it

Ante runs on iOS, Android, and web via Expo.

```bash
git clone https://github.com/chancesong10/Ante.git
cd Ante
npm install
npm start
```

Scan the QR code with the [Expo Go](https://expo.dev/go) app, or run `npm run ios` / `npm run android` / `npm run web` directly. No accounts, no API keys, no backend to stand up — it works fully offline out of the box.

## Roadmap

Ante is under active development. Roughly in priority order:

- [ ] **Charts in Analytics** — bankroll-over-time line chart, win/loss distribution, session net histogram
- [ ] **Optional cloud backup & multi-device sync**
- [ ] **CSV / PDF export** alongside the existing JSON export, for tax-adjacent recordkeeping
- [ ] **More games**: Roulette, Craps, Daily Fantasy, custom table games
- [ ] **Bankroll goals & budgeting** — set a session or monthly loss limit and a target, not just a stop-loss alert
- [ ] **Deeper Poker analytics** — position-aware stats, bluff success rate over time, leak detection
- [ ] **Light theme**
- [ ] **Home screen widgets** (iOS/Android) showing live session net without opening the app
- [ ] **Biometric app lock** for an extra layer of privacy on shared devices
- [ ] **Multi-currency support** with live conversion
- [ ] **AI-assisted insight summaries** — plain-language takeaways generated from your own stats ("You're chasing losses on Fridays — down 23% more per session than your average")

## Responsible gambling

Ante is a **tracking and analytics tool only**. It does not facilitate, process, or place any real-money wager, and it has no connection to any casino, sportsbook, or gambling operator. If gambling stops being fun, or you're worried about your own play, Ante's in-app stop-loss alerts point to the National Council on Problem Gambling 24/7 helpline: **1-800-522-4700**. If you're outside the US, please look up your local equivalent — the intent is the same everywhere: track honestly, and stop when the numbers tell you to.

---

<p align="center"><sub>© 2026 Ante. Track the truth, not the vibe.</sub></p>
