# Ante

Ante is a mobile app for tracking your gambling sessions — starting with blackjack — so you can see your real win/loss numbers instead of relying on memory or gut feeling.

## What it does

- **Log hands quickly**: enter your bet amount, mark whether you doubled down or got a blackjack, and tap the outcome (win, loss, or push).
- **Live session stats**: see your running net total, win/loss/push counts, and hand count update in real time as you play.
- **Session history**: review every hand you've logged in the current session, with bet size and net change per hand.

## Why

Most people who gamble don't have an accurate picture of their actual results — memory tends to overweight big wins and underweight the slow bleed of small losses. Ante exists to close that gap: track every hand, see the real numbers, and (eventually) surface patterns in betting behavior — like whether win streaks are followed by bigger bets, or how often losses tend to cluster.

## Current status (MVP)

This is an early build. Right now:

- Blackjack tracking is functional.
- Data is **not yet saved** between app sessions — closing the app clears your history. Persistent storage is planned next.
- History and stats are per-session only; no accounts or cloud sync yet.

## Roadmap

- [ ] Local persistence (so sessions aren't lost on app close)
- [ ] Full history screen across past sessions
- [ ] Additional games beyond blackjack (poker, sports betting)
- [ ] Behavioral insights (streak patterns, bet-sizing trends, baseline deviation alerts)

## Tech stack

- React Native + Expo
- React Navigation