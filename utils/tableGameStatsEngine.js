// Pure calculation functions — no React, no UI. Roulette and baccarat share
// one engine because what's worth measuring in both is the same thing: the
// house edge. Neither game has an in-hand decision that moves it the way
// blackjack's doubling does. The only levers a player has are which bet they
// make, what table they make it at, and how they size it — so every
// game-specific stat here is about one of those three.
//
// The generic machinery in statsEngine.js is reused where it's honest for
// these games. Two pieces deliberately aren't: conditional win rates and win
// rate by bet size. A roulette "win rate" mixes a 35:1 straight-up (hits
// ~2.6% of the time) with even-money bets (hit ~47%), so those numbers would
// mostly measure bet mix. And on a game with independent spins, "win rate
// after a loss" invites exactly the gambler's-fallacy reading this app
// should be talking people out of.
import {
  getSessionsForGameType,
  getChronologicalHands,
  calcOutcomeBreakdown,
  calcReturnStats,
  calcBetSizeAfterOutcome,
  calcStreaks,
  calcVolatility,
  calcDayOfWeekPerformance,
  calcSessionLengthPerformance,
} from './statsEngine';
import {
  ROULETTE_BET_TYPES,
  isRouletteWheel,
  rouletteHouseEdge,
  rouletteWinProbability,
  BACCARAT_SIDES,
  BACCARAT_TIE_ODDS,
  isBaccaratTieOdds,
  baccaratHouseEdge,
  baccaratWinProbability,
} from './tableGameOdds';

const stakeOf = (h) => (Number.isFinite(h?.bet) && h.bet > 0 ? h.bet : 0);
const netOf = (h) => (Number.isFinite(h?.netChange) ? h.netChange : 0);
const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);

// Hands logged before the Tie payout was recorded were all settled at 8:1 —
// the only payout the tracker offered then — so 8 is a fact about those
// records, not a guess.
export const tieOddsOf = (hand) => (isBaccaratTieOdds(hand?.tieOdds) ? hand.tieOdds : BACCARAT_TIE_ODDS);

// The house edge on one logged bet, as a { min, max } fraction. The two only
// differ for a roulette spin logged before the wheel was recorded: nothing in
// that record says whether it was a 2.70% or a 5.26% wheel, so the honest
// answer is the range rather than a guess presented as fact.
export function handHouseEdge(hand, gameType) {
  if (gameType === 'Roulette') {
    if (isRouletteWheel(hand?.wheel)) {
      const edge = rouletteHouseEdge(hand.wheel);
      return { min: edge, max: edge };
    }
    return { min: rouletteHouseEdge('single'), max: rouletteHouseEdge('double') };
  }
  if (gameType === 'Baccarat') {
    const edge = baccaratHouseEdge(hand?.betOn, tieOddsOf(hand));
    return edge === null ? null : { min: edge, max: edge };
  }
  return null;
}

// --- The headline: what the house edge expected from everything wagered,
// against what actually happened. "Luck" is the gap. Unlike a win rate this
// is comparable across bet types, because it's denominated in money. ---
export function calcExpectedVsActual(hands, gameType) {
  let sample = 0;
  let totalWagered = 0;
  let actualNet = 0;
  let lossMin = 0;
  let lossMax = 0;
  let unknownWheelSample = 0;

  hands.forEach((h) => {
    const stake = stakeOf(h);
    const edge = handHouseEdge(h, gameType);
    if (!edge || stake === 0) return;
    sample += 1;
    totalWagered += stake;
    actualNet += netOf(h);
    lossMin += stake * edge.min;
    lossMax += stake * edge.max;
    if (gameType === 'Roulette' && !isRouletteWheel(h.wheel)) unknownWheelSample += 1;
  });

  if (sample === 0) return null;

  return {
    sample,
    totalWagered,
    actualNet,
    expectedNetMin: -lossMax,
    expectedNetMax: -lossMin,
    luckMin: actualNet + lossMin,
    luckMax: actualNet + lossMax,
    houseEdgeMin: (lossMin / totalWagered) * 100,
    houseEdgeMax: (lossMax / totalWagered) * 100,
    isRange: unknownWheelSample > 0,
    unknownWheelSample,
  };
}

// Expected hit rate for one spin. With no wheel recorded, the two wheels'
// probabilities differ by well under a tenth of a point for any bet, so the
// midpoint is used rather than carrying a range through every row.
function expectedRouletteHit(hand) {
  if (isRouletteWheel(hand.wheel)) return rouletteWinProbability(hand.betType, hand.wheel);
  const single = rouletteWinProbability(hand.betType, 'single');
  const double = rouletteWinProbability(hand.betType, 'double');
  return single === null || double === null ? null : (single + double) / 2;
}

// --- Roulette: results per bet type, each against its own true odds. ---
export function calcRouletteBetTypeStats(hands) {
  if (hands.length === 0) return [];
  const totalWagered = sum(hands, stakeOf);
  const groups = {};
  hands.forEach((h) => {
    const id = h.betType || 'unknown';
    if (!groups[id]) groups[id] = [];
    groups[id].push(h);
  });

  const summarize = (id, arr) => {
    const known = ROULETTE_BET_TYPES.find((t) => t.id === id);
    const wins = arr.filter((h) => h.outcome === 'win').length;
    const wagered = sum(arr, stakeOf);
    const net = sum(arr, netOf);
    const probs = arr.map(expectedRouletteHit).filter((p) => p !== null);
    return {
      id,
      label: known ? known.label : arr[0].betLabel || 'Other',
      odds: known ? known.odds : arr[0].odds ?? null,
      sample: arr.length,
      wins,
      hitRate: (wins / arr.length) * 100,
      expectedHitRate: probs.length > 0 ? (sum(probs, (p) => p) / probs.length) * 100 : null,
      wagered,
      net,
      roi: wagered > 0 ? (net / wagered) * 100 : null,
      shareOfWagered: totalWagered > 0 ? (wagered / totalWagered) * 100 : null,
    };
  };

  const ordered = ROULETTE_BET_TYPES.filter((t) => groups[t.id]).map((t) => summarize(t.id, groups[t.id]));
  const extras = Object.keys(groups)
    .filter((id) => !ROULETTE_BET_TYPES.some((t) => t.id === id))
    .map((id) => summarize(id, groups[id]));
  return [...ordered, ...extras];
}

// --- Roulette: which wheels the money went on, and what the double-zero
// share cost over the same bets on a single-zero wheel. ---
export function calcWheelMix(hands) {
  if (hands.length === 0) return null;
  const bucket = () => ({ sample: 0, wagered: 0 });
  const mix = { single: bucket(), double: bucket(), unknown: bucket() };
  hands.forEach((h) => {
    const key = isRouletteWheel(h.wheel) ? h.wheel : 'unknown';
    mix[key].sample += 1;
    mix[key].wagered += stakeOf(h);
  });
  return {
    ...mix,
    extraCostFromDoubleZero: mix.double.wagered * (rouletteHouseEdge('double') - rouletteHouseEdge('single')),
  };
}

// --- Baccarat: each side against its true odds. ---
export function calcBaccaratSideStats(hands) {
  const totalWagered = sum(hands, stakeOf);
  return BACCARAT_SIDES.map((side) => {
    const arr = hands.filter((h) => h.betOn === side);
    if (arr.length === 0) return null;
    const wins = arr.filter((h) => h.outcome === 'win').length;
    const losses = arr.filter((h) => h.outcome === 'loss').length;
    const pushes = arr.filter((h) => h.outcome === 'push').length;
    const wagered = sum(arr, stakeOf);
    const net = sum(arr, netOf);
    const expectedLoss = sum(arr, (h) => stakeOf(h) * baccaratHouseEdge(side, tieOddsOf(h)));
    return {
      side,
      sample: arr.length,
      wins,
      losses,
      pushes,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
      expectedWinRate: baccaratWinProbability(side) * 100,
      wagered,
      net,
      roi: wagered > 0 ? (net / wagered) * 100 : null,
      shareOfWagered: totalWagered > 0 ? (wagered / totalWagered) * 100 : null,
      houseEdge: wagered > 0 ? (expectedLoss / wagered) * 100 : null,
    };
  }).filter(Boolean);
}

// --- Baccarat: what Tie bets cost in expectation, and how much of that is
// avoidable — the same money on Banker would have carried a ~1.06% edge. ---
export function calcTieBetCost(hands) {
  const ties = hands.filter((h) => h.betOn === 'Tie' && stakeOf(h) > 0);
  if (ties.length === 0) return null;
  const totalWagered = sum(hands, stakeOf);
  const tieWagered = sum(ties, stakeOf);
  const expectedCost = sum(ties, (h) => stakeOf(h) * baccaratHouseEdge('Tie', tieOddsOf(h)));
  return {
    sample: ties.length,
    tieWagered,
    shareOfWagered: (tieWagered / totalWagered) * 100,
    expectedCost,
    extraCostVsBanker: expectedCost - tieWagered * baccaratHouseEdge('Banker'),
    houseEdge: (expectedCost / tieWagered) * 100,
    net: sum(ties, netOf),
  };
}

// A bet counts as "roughly doubled" at 1.8x or more: $25 -> $50 is the
// textbook case, but players round, and $25 -> $45 is the same intent.
const DOUBLED_AT = 1.8;

// Even-money-style bets are where Martingale gets played.
function isEvenMoney(hand, gameType) {
  if (gameType === 'Roulette') return Number(hand.odds) === 1;
  return hand.betOn === 'Player' || hand.betOn === 'Banker';
}

// --- Progression (Martingale) detection: after a losing even-money bet, how
// often was the next even-money bet roughly doubled, and how long did the
// longest run of doublings go? Walked per session: the last bet of one
// session and the first of the next aren't a progression. ---
export function calcProgressionStats(sessionHistory, gameType) {
  let opportunities = 0;
  let doubledAfterLoss = 0;
  let longestChain = 0;

  getSessionsForGameType(sessionHistory, gameType).forEach((session) => {
    const seq = (Array.isArray(session.hands) ? session.hands : []).slice().reverse();
    let chain = 0;
    for (let i = 1; i < seq.length; i++) {
      const prev = seq[i - 1];
      const curr = seq[i];
      if (
        prev.outcome !== 'loss' ||
        !isEvenMoney(prev, gameType) ||
        !isEvenMoney(curr, gameType) ||
        stakeOf(prev) === 0
      ) {
        chain = 0;
        continue;
      }
      opportunities += 1;
      if (stakeOf(curr) >= stakeOf(prev) * DOUBLED_AT) {
        doubledAfterLoss += 1;
        chain += 1;
        longestChain = Math.max(longestChain, chain);
      } else {
        chain = 0;
      }
    }
  });

  if (opportunities === 0) return null;
  return {
    opportunities,
    doubledAfterLoss,
    rate: (doubledAfterLoss / opportunities) * 100,
    longestChain,
  };
}

// --- Leak detector, same shape as the other engines: scans the computed
// stats for known -EV signatures and ranks whichever clear their evidence
// threshold. `score` is a heuristic 0-100 used only to rank leaks against
// each other.
//
// Volatility is deliberately not a leak here. Inside roulette bets and Tie
// bets swing hard by design, so "high volatility" would flag a bet choice the
// player already sees, not a mistake — the card on the page still shows it.
// Loss chasing is dropped when Martingale already fired, since doubling after
// a loss is the same pattern named more precisely. ---
export function buildLeakReport({ gameType, wheelMix, tieBetCost, progression, betSizeAfterOutcome }) {
  const leaks = [];

  if (gameType === 'Roulette' && wheelMix) {
    const knownWagered = wheelMix.single.wagered + wheelMix.double.wagered;
    const share = knownWagered > 0 ? (wheelMix.double.wagered / knownWagered) * 100 : 0;
    if (wheelMix.double.sample >= 10 && share >= 50) {
      leaks.push({
        id: 'double_zero_wheel',
        score: Math.min(100, 30 + share * 0.5),
        sample: wheelMix.double.sample,
        shareOfWagered: share,
        extraCost: wheelMix.extraCostFromDoubleZero,
      });
    }
  }

  if (gameType === 'Baccarat' && tieBetCost && tieBetCost.sample >= 3 && tieBetCost.shareOfWagered >= 5) {
    leaks.push({
      id: 'tie_bets',
      score: Math.min(100, 20 + tieBetCost.shareOfWagered * 3),
      sample: tieBetCost.sample,
      shareOfWagered: tieBetCost.shareOfWagered,
      houseEdge: tieBetCost.houseEdge,
      expectedCost: tieBetCost.expectedCost,
      extraCostVsBanker: tieBetCost.extraCostVsBanker,
    });
  }

  const martingale = !!progression && progression.opportunities >= 8 && progression.rate >= 40;
  if (martingale) {
    leaks.push({
      id: 'martingale',
      score: Math.min(100, progression.rate),
      sample: progression.opportunities,
      opportunities: progression.opportunities,
      rate: progression.rate,
      longestChain: progression.longestChain,
    });
  }

  if (
    !martingale &&
    betSizeAfterOutcome.sampleAfterLoss >= 4 &&
    betSizeAfterOutcome.sampleAfterWin >= 4 &&
    betSizeAfterOutcome.avgBetAfterWin > 0 &&
    betSizeAfterOutcome.avgBetAfterLoss > betSizeAfterOutcome.avgBetAfterWin * 1.15
  ) {
    const pctIncrease =
      ((betSizeAfterOutcome.avgBetAfterLoss - betSizeAfterOutcome.avgBetAfterWin) / betSizeAfterOutcome.avgBetAfterWin) * 100;
    leaks.push({
      id: 'loss_chasing',
      score: Math.min(100, pctIncrease),
      sample: Math.min(betSizeAfterOutcome.sampleAfterWin, betSizeAfterOutcome.sampleAfterLoss),
      avgBetAfterWin: betSizeAfterOutcome.avgBetAfterWin,
      avgBetAfterLoss: betSizeAfterOutcome.avgBetAfterLoss,
      pctIncrease,
    });
  }

  leaks.sort((a, b) => b.score - a.score);
  return leaks;
}

function mixLabelOf(hand, gameType) {
  if (gameType === 'Roulette') {
    const known = ROULETTE_BET_TYPES.find((t) => t.id === hand.betType);
    return known ? known.label : hand.betLabel || 'Other';
  }
  return hand.betOn || 'Other';
}

// --- Live figures for the tracker screens (free). Takes a session's hands
// in any order. ---
export function calcSessionSummary(hands, gameType) {
  const list = Array.isArray(hands) ? hands : [];
  const totalWagered = sum(list, stakeOf);

  const groups = {};
  list.forEach((h) => {
    const label = mixLabelOf(h, gameType);
    if (!groups[label]) groups[label] = { label, count: 0, wagered: 0, net: 0 };
    groups[label].count += 1;
    groups[label].wagered += stakeOf(h);
    groups[label].net += netOf(h);
  });

  return {
    count: list.length,
    totalWagered,
    net: sum(list, netOf),
    avgBet: list.length > 0 ? totalWagered / list.length : 0,
    biggestWin: list.reduce((best, h) => Math.max(best, netOf(h)), 0),
    expected: calcExpectedVsActual(list, gameType),
    mix: Object.values(groups)
      .map((g) => ({ ...g, shareOfWagered: totalWagered > 0 ? (g.wagered / totalWagered) * 100 : null }))
      .sort((a, b) => b.wagered - a.wagered),
  };
}

// --- Master function ---
export function computeTableGameInsights(sessionHistory, gameType) {
  const hands = getChronologicalHands(sessionHistory, gameType);
  const isRoulette = gameType === 'Roulette';

  const wheelMix = isRoulette ? calcWheelMix(hands) : null;
  const tieBetCost = isRoulette ? null : calcTieBetCost(hands);
  const progression = calcProgressionStats(sessionHistory, gameType);
  const betSizeAfterOutcome = calcBetSizeAfterOutcome(hands);

  const leaks = buildLeakReport({ gameType, wheelMix, tieBetCost, progression, betSizeAfterOutcome });

  return {
    gameType,
    totalHands: hands.length,
    outcomeBreakdown: calcOutcomeBreakdown(hands),
    returnStats: calcReturnStats(hands),
    expectedVsActual: calcExpectedVsActual(hands, gameType),
    betTypeStats: isRoulette ? calcRouletteBetTypeStats(hands) : [],
    wheelMix,
    sideStats: isRoulette ? [] : calcBaccaratSideStats(hands),
    tieBetCost,
    progression,
    betSizeAfterOutcome,
    streaks: calcStreaks(hands),
    volatility: calcVolatility(hands),
    dayOfWeekPerformance: calcDayOfWeekPerformance(sessionHistory, gameType),
    sessionLengthPerformance: calcSessionLengthPerformance(sessionHistory, gameType),
    leaks,
    topLeak: leaks[0] || null,
  };
}
