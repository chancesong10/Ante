// Counting a session's hands — the one arithmetic every screen in the app
// needed and each had written out for itself.
//
// A blackjack split is stored as a single record (`type: 'split'`) holding two
// real hands, so anything that counts hands, sums money, or tallies outcomes
// has to expand those first. That expansion was copy-pasted in eight places,
// and had already drifted: three of them — SessionContext's finalizer,
// BlackjackScreen's live totals and statsEngine's chronological walk — omitted
// the `r.hands` guard the other five had, so a split record missing its halves
// would put `undefined` into the list and throw on the next property read
// rather than being skipped.
//
// No React, no UI — this is pure arithmetic over hand records.

// The hands a list of records actually represents, splits expanded into their
// halves. A split record with nothing in it contributes nothing rather than an
// `undefined` hand.
export function expandHands(records) {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const record of records) appendHand(out, record);
  return out;
}

// The single-record half of the above, for callers walking a list in an order
// of their own — oldest-first, say — that would otherwise copy and reverse it
// just to hand it over.
export function appendHand(out, record) {
  if (!record) return out;
  if (record.type === 'split') {
    if (Array.isArray(record.hands)) {
      for (const hand of record.hands) out.push(hand);
    }
  } else {
    out.push(record);
  }
  return out;
}

const EMPTY_TALLY = {
  count: 0,
  net: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  folds: 0,
  splits: 0,
  bluffedFolds: 0,
  goodFolds: 0,
  grossWins: 0,
  grossLosses: 0,
  wagered: 0,
};

// Everything the app ever asks of a hand list, in one pass over it.
//
// Outcome counts are kept raw and separate — `losses` is strictly `loss`, not
// loss-or-fold — because the callers genuinely disagree about which belongs
// with which: a completed session record folds folds into losses, while the
// live blackjack tracker shows them apart. Combining is the caller's call;
// this only counts.
//
// `wagered` doubles a doubled-down bet, since that is the money actually at
// risk on the hand.
export function tallyHands(records) {
  const hands = expandHands(records);
  if (hands.length === 0) return { ...EMPTY_TALLY };

  const t = { ...EMPTY_TALLY, count: hands.length };

  for (const hand of hands) {
    const netChange = hand.netChange || 0;
    t.net += netChange;
    if (netChange > 0) t.grossWins += netChange;
    else if (netChange < 0) t.grossLosses -= netChange;

    t.wagered += (hand.bet || 0) * (hand.doubled ? 2 : 1);

    switch (hand.outcome) {
      case 'win':
        t.wins += 1;
        break;
      case 'loss':
        t.losses += 1;
        break;
      case 'push':
        t.pushes += 1;
        break;
      case 'split':
        t.splits += 1;
        break;
      case 'fold':
        t.folds += 1;
        if (hand.foldReason === 'bluffed') t.bluffedFolds += 1;
        else if (hand.foldReason === 'good_fold') t.goodFolds += 1;
        break;
      default:
        break;
    }
  }

  return t;
}

// The one empty array every tracker screen falls back to when no session is
// running yet. Shared, and frozen, because `session?.hands || []` minted a
// fresh array on each render: every useMemo keyed on it saw a new dependency
// every time and recomputed regardless, which is the opposite of the point.
const NO_HANDS = Object.freeze([]);

export function handsOf(session) {
  return Array.isArray(session?.hands) ? session.hands : NO_HANDS;
}

// What a running session is worth right now, and how much has been logged
// into it. Hand-based games sum netChange; a buy-in game has no known live
// balance until the cash-out is entered, so it reports 0 rather than treating
// an un-entered cash-out as a total loss of the buy-in.
//
// Net and count come back together because the callers that want one usually
// want both, and asking separately meant expanding the same splits twice.
export function liveTallyOf(session) {
  const hands = handsOf(session);
  if (hands.length > 0) {
    const tally = tallyHands(hands);
    return { net: tally.net, count: tally.count };
  }
  if (session?.buyIn != null && session?.cashOut != null) {
    return { net: session.cashOut - session.buyIn, count: 0 };
  }
  return { net: 0, count: 0 };
}

export function liveNetOf(session) {
  return liveTallyOf(session).net;
}

export function liveCountOf(session) {
  return expandHands(session?.hands).length;
}

// Win rate as a percentage of decided hands, or 0 when nothing is decided
// yet. Pulled out because every caller had the same `a + b > 0 ? … : 0`
// guard around it, and two of them disagreed on the fallback.
export function winRateOf(wins, losses) {
  const decided = wins + losses;
  return decided > 0 ? (wins / decided) * 100 : 0;
}

// Min/max over a numeric list without `Math.max(...arr)`. The spread form
// passes one argument per element, which throws a RangeError once the list
// gets long — a real ceiling for someone with years of sessions logged, and
// a crash on the screen that is meant to celebrate having that much history.
export function extent(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}
