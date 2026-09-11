// Pure calculation functions — no React, no UI. Insights from blackjack hands
// logged with cards: your two cards, the dealer's upcard, your first play,
// and optionally how the hand ended. statsEngine.js keeps covering every
// hand; this file only reads the ones with card detail, so a player who never
// taps a card simply gets nothing extra here.
//
// A "record" is what the tracker logs: a single hand, or a split whose two
// sub-hands share the one decision (the split) and its cards.
import { getSessionsForGameType } from './statsEngine';
import {
  basicStrategy,
  describeHand,
  isCardRank,
  normalizeBlackjackRules,
  situationLabel,
  blackjackPayoutMultiplier,
  DEALER_BUST_RATE,
} from './blackjackStrategy';

export const hasCardDetail = (record) =>
  !!record &&
  Array.isArray(record.playerCards) &&
  record.playerCards.length === 2 &&
  record.playerCards.every(isCardRank) &&
  isCardRank(record.dealerUp);

const subHands = (r) => (r.type === 'split' && Array.isArray(r.hands) ? r.hands : [r]);
// Includes any insurance result, which the tracker folds into netChange so
// session totals stay right everywhere else in the app.
const recordNet = (r) => subHands(r).reduce((s, h) => s + (Number.isFinite(h.netChange) ? h.netChange : 0), 0);
const recordStake = (r) => subHands(r).reduce((s, h) => s + (h.bet || 0) * (h.doubled ? 2 : 1), 0);

function blackjackRecords(sessionHistory) {
  const out = [];
  getSessionsForGameType(sessionHistory, 'Blackjack').forEach((session) => {
    // Stored newest-first; walk them in the order they were played.
    (Array.isArray(session.hands) ? session.hands : [])
      .slice()
      .reverse()
      .forEach((r) => {
        if (r && typeof r === 'object') out.push(r);
      });
  });
  return out;
}

export const getDetailedRecords = (sessionHistory) => blackjackRecords(sessionHistory).filter(hasCardDetail);

// Checks one logged decision against basic strategy. Null when there's no
// decision to judge: no cards, no play recorded, a natural, or a dealer
// blackjack (the dealer peeks before anyone acts, so there was no choice).
export function judgeRecord(record) {
  if (!hasCardDetail(record) || !record.action || record.endTag === 'dealer_blackjack') return null;
  const strategy = basicStrategy(record.playerCards, record.dealerUp, record.rules);
  if (!strategy) return null;
  return {
    recommended: strategy.action,
    correct: strategy.accepted.includes(record.action),
    situation: situationLabel(strategy.hand, record.dealerUp),
  };
}

// --- How often the player's play matched basic strategy, and the spots they
// miss most, grouped by situation and what they did instead. ---
export function calcStrategyAccuracy(records) {
  let judged = 0;
  let correct = 0;
  const mistakes = {};

  records.forEach((r) => {
    const verdict = judgeRecord(r);
    if (!verdict) return;
    judged += 1;
    if (verdict.correct) {
      correct += 1;
      return;
    }
    const key = `${verdict.situation}|${r.action}`;
    if (!mistakes[key]) {
      mistakes[key] = {
        situation: verdict.situation,
        action: r.action,
        recommended: verdict.recommended,
        count: 0,
        net: 0,
      };
    }
    mistakes[key].count += 1;
    mistakes[key].net += recordNet(r);
  });

  if (judged === 0) return null;
  return {
    judged,
    correct,
    mistakeCount: judged - correct,
    rate: (correct / judged) * 100,
    // Most frequent first; ties go to whichever cost more.
    topMistakes: Object.values(mistakes).sort((a, b) => b.count - a.count || a.net - b.net),
  };
}

// --- Doubling, hand by hand: of the hands where strategy says double, how
// many were doubled; and how many doubles strategy says to avoid. Replaces
// the "~10% of hands" frequency benchmark once there's card data. ---
export function calcDoublingDecisions(records) {
  let chances = 0;
  let taken = 0;
  let doubles = 0;
  let badDoubles = 0;

  records.forEach((r) => {
    if (!judgeRecord(r)) return;
    const strategy = basicStrategy(r.playerCards, r.dealerUp, r.rules);
    const didDouble = r.action === 'double';
    if (strategy.action === 'double') {
      chances += 1;
      if (didDouble) taken += 1;
    }
    if (didDouble) {
      doubles += 1;
      if (!strategy.accepted.includes('double')) badDoubles += 1;
    }
  });

  if (chances === 0 && doubles === 0) return null;
  return {
    chances,
    taken,
    missed: chances - taken,
    takenRate: chances > 0 ? (taken / chances) * 100 : null,
    doubles,
    badDoubles,
  };
}

export const SITUATION_LABELS = {
  hard_low: 'Hard 11 or less',
  stiff: 'Stiff hands (hard 12–16)',
  hard_high: 'Hard 17+',
  soft: 'Soft hands',
  pair: 'Pairs',
  blackjack: 'Blackjacks',
};

function categoryOf(hand) {
  if (hand.isBlackjack) return 'blackjack';
  if (hand.isPair) return 'pair';
  if (hand.soft) return 'soft';
  if (hand.total <= 11) return 'hard_low';
  if (hand.total <= 16) return 'stiff';
  return 'hard_high';
}

const isWeakUpcard = (up) => ['2', '3', '4', '5', '6'].includes(up);

// --- Net result by starting-hand category, split by dealer upcard strength:
// weak (2–6) or strong (7–A). ---
export function calcSituationResults(records) {
  const empty = () => ({ sample: 0, net: 0, stake: 0 });
  const groups = {};
  records.forEach((r) => {
    const hand = describeHand(r.playerCards);
    const cat = categoryOf(hand);
    if (!groups[cat]) groups[cat] = { weak: empty(), strong: empty() };
    const bucket = groups[cat][isWeakUpcard(r.dealerUp) ? 'weak' : 'strong'];
    bucket.sample += 1;
    bucket.net += recordNet(r);
    bucket.stake += recordStake(r);
  });

  const summarize = (b) => ({ sample: b.sample, net: b.net, roi: b.stake > 0 ? (b.net / b.stake) * 100 : null });
  return Object.keys(SITUATION_LABELS)
    .filter((id) => groups[id])
    .map((id) => ({
      id,
      label: SITUATION_LABELS[id],
      vsWeak: summarize(groups[id].weak),
      vsStrong: summarize(groups[id].strong),
    }));
}

// --- Insurance: how often it was offered (dealer Ace), taken, and what it
// returned. The tracker doesn't offer insurance on a split, so only singles
// count. ---
export function calcInsurance(records) {
  const offered = records.filter((r) => r.type !== 'split' && r.dealerUp === 'A');
  if (offered.length === 0) return null;
  const taken = offered.filter((r) => r.insurance === true);
  return {
    offered: offered.length,
    taken: taken.length,
    net: taken.reduce((s, r) => s + (Number.isFinite(r.insuranceNet) ? r.insuranceNet : 0), 0),
  };
}

// Tags where the dealer played the hand out. "I busted" is excluded — the
// dealer never draws against a busted hand, so it says nothing about the
// dealer's bust rate.
const DEALER_PLAYED_TAGS = ['dealer_bust', 'player_higher', 'dealer_higher', 'dealer_blackjack'];

// --- How often the dealer busted, against the usual rate for those upcards.
// Only hands the player tagged count: an untagged hand could have gone either
// way, and guessing would bias the rate. ---
export function calcDealerBust(records) {
  const eligible = records.filter((r) => r.type !== 'split' && DEALER_PLAYED_TAGS.includes(r.endTag));
  if (eligible.length === 0) return null;

  const summarize = (arr) => {
    if (arr.length === 0) return { sample: 0, busts: 0, rate: null, expectedRate: null };
    const busts = arr.filter((r) => r.endTag === 'dealer_bust').length;
    return {
      sample: arr.length,
      busts,
      rate: (busts / arr.length) * 100,
      expectedRate: arr.reduce((s, r) => s + DEALER_BUST_RATE[r.dealerUp], 0) / arr.length,
    };
  };

  return {
    weak: summarize(eligible.filter((r) => isWeakUpcard(r.dealerUp))),
    strong: summarize(eligible.filter((r) => !isWeakUpcard(r.dealerUp))),
  };
}

// --- The table rules hands were played under. Every hand logged by the
// redesigned tracker carries its rules, cards or not; older hands without
// rules are left out rather than assumed. ---
export function calcTableRules(sessionHistory) {
  let hands = 0;
  let sixFiveHands = 0;
  let sixFiveBlackjacks = 0;
  let sixFiveCost = 0;
  let h17Hands = 0;

  blackjackRecords(sessionHistory).forEach((r) => {
    if (!r.rules) return;
    const rules = normalizeBlackjackRules(r.rules);
    hands += 1;
    if (rules.dealerHitsSoft17) h17Hands += 1;
    if (rules.payout === '6:5') {
      sixFiveHands += 1;
      if (r.type !== 'split' && r.blackjack && r.outcome === 'win') {
        sixFiveBlackjacks += 1;
        sixFiveCost += (r.bet || 0) * (blackjackPayoutMultiplier('3:2') - blackjackPayoutMultiplier('6:5'));
      }
    }
  });

  if (hands === 0) return null;
  return {
    hands,
    sixFiveHands,
    sixFiveShare: (sixFiveHands / hands) * 100,
    sixFiveBlackjacks,
    sixFiveCost,
    h17Hands,
    h17Share: (h17Hands / hands) * 100,
  };
}

// --- Card-level leaks, same scoring shape as statsEngine's buildLeakReport so
// the two lists can be merged and ranked together. ---
export function buildDetailLeaks({ accuracy, doubling, insurance, tableRules }) {
  const leaks = [];

  if (accuracy && accuracy.judged >= 20 && accuracy.rate < 90 && accuracy.topMistakes.length > 0) {
    leaks.push({
      id: 'strategy_mistakes',
      score: Math.min(100, (100 - accuracy.rate) * 3),
      sample: accuracy.judged,
      judged: accuracy.judged,
      rate: accuracy.rate,
      topMistake: accuracy.topMistakes[0],
    });
  }

  if (doubling && doubling.chances >= 8 && doubling.takenRate < 70) {
    leaks.push({
      id: 'missed_doubles',
      score: Math.min(100, 100 - doubling.takenRate),
      sample: doubling.chances,
      chances: doubling.chances,
      missed: doubling.missed,
      takenRate: doubling.takenRate,
    });
  }

  if (insurance && insurance.taken >= 3) {
    leaks.push({
      id: 'insurance',
      score: Math.min(100, 30 + insurance.taken * 5),
      sample: insurance.offered,
      offered: insurance.offered,
      taken: insurance.taken,
      net: insurance.net,
    });
  }

  if (tableRules && tableRules.sixFiveHands >= 20 && tableRules.sixFiveShare >= 50) {
    leaks.push({
      id: 'six_five_tables',
      score: Math.min(100, 40 + tableRules.sixFiveShare * 0.4),
      sample: tableRules.hands,
      hands: tableRules.hands,
      share: tableRules.sixFiveShare,
      blackjacks: tableRules.sixFiveBlackjacks,
      cost: tableRules.sixFiveCost,
    });
  }

  leaks.sort((a, b) => b.score - a.score);
  return leaks;
}

// --- Master function ---
export function computeBlackjackDetailInsights(sessionHistory) {
  const records = getDetailedRecords(sessionHistory);
  const accuracy = calcStrategyAccuracy(records);
  const doubling = calcDoublingDecisions(records);
  const insurance = calcInsurance(records);
  const tableRules = calcTableRules(sessionHistory);

  return {
    detailedHands: records.length,
    accuracy,
    doubling,
    situations: calcSituationResults(records),
    insurance,
    dealerBust: calcDealerBust(records),
    tableRules,
    leaks: buildDetailLeaks({ accuracy, doubling, insurance, tableRules }),
  };
}
