// Blackjack hand-record assembly — no React, no UI.
//
// The per-hand money math already lived in blackjackStrategy (calcBlackjackNet,
// calcInsuranceNet) and was tested. What sat untested in BlackjackScreen was
// the assembly around it: turning two form-state hands into the one `type:
// 'split'` record that finalizeSession later flattens with
//
//   hands.flatMap((r) => (r.type === 'split' ? r.hands : [r]))
//
// A malformed split record therefore doesn't throw — it silently changes
// every hand-level stat in the app, which is exactly the failure a test
// should catch.
import { calcBlackjackNet } from './blackjackStrategy';

// One half of a split. Bet arrives as form text, so it is parsed here rather
// than at the call site; a blank or unparseable amount becomes 0 rather than
// NaN, which would poison every sum it later flows into.
export function toSplitHand(hand, payout = '3:2') {
  const bet = Number.parseFloat(hand?.betAmount);
  const safeBet = Number.isFinite(bet) ? bet : 0;
  const doubled = !!hand?.doubled;
  return {
    bet: safeBet,
    doubled,
    // A split hand making 21 is not a natural and does not pay 3:2 — that is
    // a rule of the game, not an oversight, so it is pinned false here rather
    // than derived.
    blackjack: false,
    outcome: hand?.outcome,
    netChange: calcBlackjackNet({ bet: safeBet, doubled, outcome: hand?.outcome, payout }),
  };
}

// The record a split round contributes to the session. `id` and `createdAt`
// are injected so this stays pure.
export function buildSplitRecord({ id, createdAt, hands, rules, extra = {} }) {
  const payout = rules?.payout || '3:2';
  return {
    id,
    type: 'split',
    hands: (hands || []).map((h) => toSplitHand(h, payout)),
    // Every hand keeps the rules it was played under, cards or not.
    rules,
    createdAt,
    ...extra,
  };
}

// What a split round nets overall — the sum of its halves. Each half carries
// its own bet, so a doubled second hand is weighted correctly rather than
// being averaged against the first.
export function splitRecordNet(record) {
  if (!record || !Array.isArray(record.hands)) return 0;
  return record.hands.reduce((sum, h) => sum + (Number(h?.netChange) || 0), 0);
}
