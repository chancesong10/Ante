// Pure calculation functions — no React, no UI. Mirrors the structure of
// statsEngine.js, but built around poker's data model: hands don't resolve
// as win/loss/push, they resolve as win/split/loss/fold, and a fold is
// tagged with what it turned out to be (foldReason: 'bluffed' | 'good_fold'
// | 'no_show'). That fold-quality tag is the signal none of the other
// tracked games have, so most of what's below exists to mine it.
import {
  getSessionsForGameType,
  calcDayOfWeekPerformance,
  calcSessionLengthPerformance,
} from './statsEngine';

export { calcDayOfWeekPerformance, calcSessionLengthPerformance };

const STREET_ORDER = ['Pre-Flop', 'Flop', 'Turn (4th)', 'River (5th)', 'Showdown'];

// Flattens every Poker/'hands' session into one chronological hand list,
// tagging each hand with the session context (big blind, position within
// the session) that several stats below need but no single hand carries.
export function getChronologicalPokerHands(sessionHistory) {
  const sessions = getSessionsForGameType(sessionHistory, 'Poker');
  const allHands = [];
  sessions.forEach((session) => {
    const chronological = (session.hands || []).slice().reverse();
    chronological.forEach((h, idx) => {
      allHands.push({
        ...h,
        _bigBlind: session.bigBlind || 0,
        _sessionId: session.id,
        _indexInSession: idx,
        _totalInSession: chronological.length,
      });
    });
  });
  return allHands;
}

// --- Overall outcome breakdown ---
export function calcOutcomeBreakdown(hands) {
  const sample = hands.length;
  if (sample === 0) {
    return { wins: 0, splits: 0, losses: 0, folds: 0, sample: 0, winRate: null, splitRate: null, lossRate: null, foldRate: null };
  }
  const wins = hands.filter((h) => h.outcome === 'win').length;
  const splits = hands.filter((h) => h.outcome === 'split').length;
  const losses = hands.filter((h) => h.outcome === 'loss').length;
  const folds = hands.filter((h) => h.outcome === 'fold').length;
  return {
    wins,
    splits,
    losses,
    folds,
    sample,
    winRate: (wins / sample) * 100,
    splitRate: (splits / sample) * 100,
    lossRate: (losses / sample) * 100,
    foldRate: (folds / sample) * 100,
  };
}

// --- Money in, money out. Folds count too: heroInvestment is the chips
// forfeited by folding, netChange is always -heroInvestment on a fold. ---
export function calcReturnStats(hands) {
  const sample = hands.length;
  const totalInvested = hands.reduce((sum, h) => sum + (h.heroInvestment || 0), 0);
  const netProfit = hands.reduce((sum, h) => sum + (h.netChange || 0), 0);
  return {
    sample,
    totalInvested,
    netProfit,
    roi: totalInvested > 0 ? (netProfit / totalInvested) * 100 : null,
    avgResultPerHand: sample > 0 ? netProfit / sample : null,
  };
}

// --- Results normalized to big blinds — the standard way poker results are
// actually compared across different stakes. A dollar figure from a $1/$2
// session and a $5/$10 session aren't comparable; bb/100 is. Hands from
// no-blind/casual sessions (bigBlind 0) are excluded rather than skewing
// the rate. ---
export function calcBBStats(hands) {
  const valid = hands.filter((h) => h._bigBlind && h._bigBlind > 0);
  if (valid.length === 0) return null;
  const netBB = valid.reduce((sum, h) => sum + (h.netChange || 0) / h._bigBlind, 0);
  const avgInvestmentBB = valid.reduce((sum, h) => sum + (h.heroInvestment || 0) / h._bigBlind, 0) / valid.length;
  return {
    sample: valid.length,
    netBB,
    bbPer100: (netBB / valid.length) * 100,
    avgInvestmentBB,
  };
}

// --- The headline feature: fold-quality. bluffedRate is measured only
// against JUDGED folds (bluffed + good_fold) — a 'no_show' means the
// player never learned who was right, so it can't count as evidence
// either way. ---
export function calcFoldStats(hands) {
  const folds = hands.filter((h) => h.outcome === 'fold');
  const bluffed = folds.filter((h) => h.foldReason === 'bluffed');
  const goodFold = folds.filter((h) => h.foldReason === 'good_fold');
  const noShow = folds.filter((h) => h.foldReason === 'no_show' || !h.foldReason);
  const judged = bluffed.length + goodFold.length;

  const moneyLeftOnTable = bluffed.reduce(
    (sum, h) => sum + Math.max(0, (h.pot || 0) - (h.heroInvestment || 0)),
    0
  );
  const bbBluffed = bluffed.filter((h) => h._bigBlind > 0);
  const moneyLeftOnTableBB = bbBluffed.reduce(
    (sum, h) => sum + Math.max(0, (h.pot || 0) - (h.heroInvestment || 0)) / h._bigBlind,
    0
  );

  const avgPot = (arr) => (arr.length > 0 ? arr.reduce((s, h) => s + (h.pot || 0), 0) / arr.length : null);

  return {
    sample: folds.length,
    bluffed: bluffed.length,
    goodFold: goodFold.length,
    noShow: noShow.length,
    judgedSample: judged,
    bluffedRate: judged > 0 ? (bluffed.length / judged) * 100 : null,
    goodFoldRate: judged > 0 ? (goodFold.length / judged) * 100 : null,
    moneyLeftOnTable,
    moneyLeftOnTableBB: bbBluffed.length > 0 ? moneyLeftOnTableBB : null,
    avgPotWhenBluffed: avgPot(bluffed),
    avgPotWhenGoodFold: avgPot(goodFold),
  };
}

// --- Same fold-quality breakdown, split out by which street the fold
// happened on. River folds are the ones that hurt most — the pot is at
// its biggest by then — so this is where a "leak" actually gets found. ---
export function calcFoldsByStreet(hands) {
  const folds = hands.filter((h) => h.outcome === 'fold');
  if (folds.length === 0) return [];

  const groups = {};
  folds.forEach((h) => {
    const street = h.streetFolded || 'Unknown';
    if (!groups[street]) groups[street] = [];
    groups[street].push(h);
  });

  const summarize = (street, arr) => {
    const bluffed = arr.filter((h) => h.foldReason === 'bluffed').length;
    const goodFold = arr.filter((h) => h.foldReason === 'good_fold').length;
    const noShow = arr.filter((h) => h.foldReason === 'no_show' || !h.foldReason).length;
    const judged = bluffed + goodFold;
    const moneyLeftOnTable = arr
      .filter((h) => h.foldReason === 'bluffed')
      .reduce((sum, h) => sum + Math.max(0, (h.pot || 0) - (h.heroInvestment || 0)), 0);
    return {
      street,
      sample: arr.length,
      bluffed,
      goodFold,
      noShow,
      bluffedRate: judged > 0 ? (bluffed / judged) * 100 : null,
      moneyLeftOnTable,
    };
  };

  const ordered = STREET_ORDER.filter((s) => groups[s]).map((s) => summarize(s, groups[s]));
  const extras = Object.keys(groups)
    .filter((s) => !STREET_ORDER.includes(s))
    .map((s) => summarize(s, groups[s]));

  return [...ordered, ...extras];
}

// --- Tilt signature: does getting bluffed change how the very NEXT fold
// gets judged? This walks the fold-only subsequence (ignoring hands that
// aren't folds in between), so it measures fold-judgment autocorrelation
// specifically, independent of how often the player folds at all.
// 'no_show' folds are excluded as both a preceding and following event —
// an unresolved fold can't condition or be conditioned on judgment. ---
export function calcPostBluffPattern(hands) {
  const judgedFolds = hands.filter(
    (h) => h.outcome === 'fold' && (h.foldReason === 'bluffed' || h.foldReason === 'good_fold')
  );

  const afterBluffed = { bluffed: 0, good: 0 };
  const afterGood = { bluffed: 0, good: 0 };

  for (let i = 1; i < judgedFolds.length; i++) {
    const prev = judgedFolds[i - 1].foldReason;
    const curr = judgedFolds[i].foldReason;
    const bucket = prev === 'bluffed' ? afterBluffed : afterGood;
    if (curr === 'bluffed') bucket.bluffed++;
    else bucket.good++;
  }

  const rate = (g) => {
    const total = g.bluffed + g.good;
    return { rate: total > 0 ? (g.bluffed / total) * 100 : null, sample: total };
  };

  const afterBluffedRate = rate(afterBluffed);
  const afterGoodRate = rate(afterGood);
  const tiltIndex =
    afterBluffedRate.rate !== null && afterGoodRate.rate !== null
      ? afterBluffedRate.rate - afterGoodRate.rate
      : null;

  return { afterBluffed: afterBluffedRate, afterGood: afterGoodRate, tiltIndex };
}

// --- Loss-chasing analog: does the player invest more in the hand right
// after losing money than right after winning it? "Loss" here means any
// hand with a negative netChange, so a costly fold counts the same as a
// showdown loss — both are the kind of hand that precedes tilt betting. ---
export function calcInvestmentAfterOutcome(hands) {
  const afterWin = [];
  const afterLoss = [];
  for (let i = 1; i < hands.length; i++) {
    const prevChange = hands[i - 1].netChange || 0;
    if (prevChange > 0) afterWin.push(hands[i].heroInvestment || 0);
    if (prevChange < 0) afterLoss.push(hands[i].heroInvestment || 0);
  }
  const avg = (arr) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  return {
    avgInvestmentAfterWin: avg(afterWin),
    avgInvestmentAfterLoss: avg(afterLoss),
    sampleAfterWin: afterWin.length,
    sampleAfterLoss: afterLoss.length,
  };
}

// --- Streaks by money, not by outcome label. A fold and a showdown loss
// both drain the stack the same way, so both count as a "down" hand —
// unlike blackjack's push, a poker fold is never a neutral result. ---
export function calcStreaks(hands) {
  if (hands.length === 0) {
    return { currentStreakType: null, currentStreakLength: 0, longestUpStreak: 0, longestDownStreak: 0 };
  }
  const typeOf = (h) => {
    const net = h.netChange || 0;
    if (net > 0) return 'up';
    if (net < 0) return 'down';
    return null;
  };

  const lastType = typeOf(hands[hands.length - 1]);
  let currentStreakLength = 0;
  for (let i = hands.length - 1; i >= 0; i--) {
    if (lastType !== null && typeOf(hands[i]) === lastType) currentStreakLength++;
    else break;
  }

  let longestUpStreak = 0;
  let longestDownStreak = 0;
  let runType = null;
  let runLength = 0;

  hands.forEach((h) => {
    const t = typeOf(h);
    if (t !== null) {
      if (t === runType) runLength++;
      else {
        runType = t;
        runLength = 1;
      }
      if (runType === 'up') longestUpStreak = Math.max(longestUpStreak, runLength);
      if (runType === 'down') longestDownStreak = Math.max(longestDownStreak, runLength);
    } else {
      runType = null;
      runLength = 0;
    }
  });

  return { currentStreakType: lastType, currentStreakLength, longestUpStreak, longestDownStreak };
}

// --- Volatility, same formula and thresholds validated for blackjack's
// calcVolatility, applied to heroInvestment instead of bet. ---
function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function calcVolatility(hands) {
  const netChanges = hands.map((h) => h.netChange || 0);
  const investments = hands.map((h) => h.heroInvestment || 0);
  const avgInvestment = investments.length > 0 ? investments.reduce((s, v) => s + v, 0) / investments.length : 0;

  const netStdDev = stdDev(netChanges);
  const investmentStdDev = stdDev(investments);
  const volatilityRatio = avgInvestment > 0 ? netStdDev / avgInvestment : null;

  let riskLabel = null;
  if (volatilityRatio !== null) {
    if (volatilityRatio < 1.2) riskLabel = 'Low';
    else if (volatilityRatio < 2.2) riskLabel = 'Moderate';
    else riskLabel = 'High';
  }

  return {
    netResultStdDev: netStdDev,
    investmentStdDev,
    investmentConsistency: avgInvestment > 0 ? Math.max(0, 100 - (investmentStdDev / avgInvestment) * 100) : null,
    volatilityRatio,
    riskLabel,
  };
}

// --- What share of the average pot is the player's own money? High =
// they're driving the betting (isolating / aggressive). Low = they're
// mostly calling into pots other people built (passive / multiway). ---
export function calcCommitmentRatio(hands) {
  const withPot = hands.filter((h) => (h.pot || 0) > 0);
  if (withPot.length === 0) return null;
  const ratios = withPot.map((h) => (h.heroInvestment || 0) / h.pot);
  const avgRatio = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  return { avgCommitmentPct: avgRatio * 100, sample: withPot.length };
}

// --- Classic "won money at showdown" rate: of the hands that were actually
// played to a result (not folded), how many did the player win or chop? ---
export function calcShowdownStats(hands) {
  const showdownHands = hands.filter((h) => h.outcome !== 'fold');
  if (showdownHands.length === 0) {
    return { sample: 0, winOrSplitRate: null, wins: 0, splits: 0, losses: 0 };
  }
  const wins = showdownHands.filter((h) => h.outcome === 'win').length;
  const splits = showdownHands.filter((h) => h.outcome === 'split').length;
  const losses = showdownHands.filter((h) => h.outcome === 'loss').length;
  return {
    sample: showdownHands.length,
    wins,
    splits,
    losses,
    winOrSplitRate: ((wins + splits) / showdownHands.length) * 100,
  };
}

// --- Does fold judgment erode over the back half of a session? Splits
// each session's hands at its own midpoint (not a fixed hand count, since
// sessions vary in length) and compares bluffed-fold rate early vs late,
// pooled across every session with enough folds on both sides. ---
export function calcSessionFoldFatigue(hands) {
  const firstHalfFolds = [];
  const secondHalfFolds = [];

  hands.forEach((h) => {
    if (h.outcome !== 'fold') return;
    if (h.foldReason !== 'bluffed' && h.foldReason !== 'good_fold') return;
    const midpoint = (h._totalInSession || 1) / 2;
    if (h._indexInSession < midpoint) firstHalfFolds.push(h);
    else secondHalfFolds.push(h);
  });

  const rate = (arr) => {
    const bluffed = arr.filter((h) => h.foldReason === 'bluffed').length;
    const total = arr.length;
    return { rate: total > 0 ? (bluffed / total) * 100 : null, sample: total };
  };

  const first = rate(firstHalfFolds);
  const second = rate(secondHalfFolds);

  if (first.sample < 3 || second.sample < 3) return null;

  return {
    firstHalf: first,
    secondHalf: second,
    fatigueDelta: second.rate - first.rate,
  };
}

// --- Leak detector: scans the computed stats for known -EV signatures and
// ranks whichever ones clear their evidence threshold. `score` is a
// heuristic 0-100 used only to rank leaks against each other, not a
// probability or a dollar figure — the metric fields alongside it carry
// the real numbers a UI would surface. ---
export function buildLeakReport({
  foldStats,
  foldsByStreet,
  postBluffPattern,
  investmentAfterOutcome,
  volatility,
  foldFatigue,
}) {
  const leaks = [];

  if (foldStats.judgedSample >= 4 && foldStats.bluffedRate !== null && foldStats.bluffedRate > 35) {
    leaks.push({
      id: 'bluff_catching',
      score: Math.min(100, foldStats.bluffedRate),
      sample: foldStats.judgedSample,
      bluffedRate: foldStats.bluffedRate,
      moneyLeftOnTable: foldStats.moneyLeftOnTable,
      moneyLeftOnTableBB: foldStats.moneyLeftOnTableBB,
    });
  }

  const streetCandidates = foldsByStreet.filter(
    (s) => s.street !== 'Showdown' && s.sample >= 3 && s.bluffedRate !== null && s.bluffedRate >= 40
  );
  if (streetCandidates.length > 0) {
    const worst = streetCandidates.reduce((a, b) => (b.moneyLeftOnTable > a.moneyLeftOnTable ? b : a));
    leaks.push({
      id: 'street_leak',
      score: Math.min(100, worst.bluffedRate),
      sample: worst.sample,
      street: worst.street,
      bluffedRate: worst.bluffedRate,
      moneyLeftOnTable: worst.moneyLeftOnTable,
    });
  }

  if (
    postBluffPattern.afterBluffed.sample >= 4 &&
    postBluffPattern.afterGood.sample >= 4 &&
    postBluffPattern.tiltIndex !== null &&
    postBluffPattern.tiltIndex > 15
  ) {
    leaks.push({
      id: 'tilt_after_bluff',
      score: Math.min(100, postBluffPattern.tiltIndex * 2.5),
      sample: postBluffPattern.afterBluffed.sample + postBluffPattern.afterGood.sample,
      tiltIndex: postBluffPattern.tiltIndex,
      afterBluffedRate: postBluffPattern.afterBluffed.rate,
      afterGoodRate: postBluffPattern.afterGood.rate,
    });
  }

  if (
    investmentAfterOutcome.sampleAfterLoss >= 4 &&
    investmentAfterOutcome.sampleAfterWin >= 4 &&
    investmentAfterOutcome.avgInvestmentAfterWin > 0 &&
    investmentAfterOutcome.avgInvestmentAfterLoss > investmentAfterOutcome.avgInvestmentAfterWin * 1.15
  ) {
    const pctIncrease =
      ((investmentAfterOutcome.avgInvestmentAfterLoss - investmentAfterOutcome.avgInvestmentAfterWin) /
        investmentAfterOutcome.avgInvestmentAfterWin) *
      100;
    leaks.push({
      id: 'loss_chasing',
      score: Math.min(100, pctIncrease),
      sample: Math.min(investmentAfterOutcome.sampleAfterWin, investmentAfterOutcome.sampleAfterLoss),
      avgInvestmentAfterWin: investmentAfterOutcome.avgInvestmentAfterWin,
      avgInvestmentAfterLoss: investmentAfterOutcome.avgInvestmentAfterLoss,
      pctIncrease,
    });
  }

  if (volatility.riskLabel === 'High') {
    leaks.push({
      id: 'volatility',
      score: Math.min(100, (volatility.volatilityRatio || 0) * 25),
      volatilityRatio: volatility.volatilityRatio,
    });
  }

  if (foldFatigue && foldFatigue.fatigueDelta !== null && foldFatigue.fatigueDelta > 15) {
    leaks.push({
      id: 'session_fatigue',
      score: Math.min(100, foldFatigue.fatigueDelta * 2.5),
      sample: foldFatigue.firstHalf.sample + foldFatigue.secondHalf.sample,
      firstHalfRate: foldFatigue.firstHalf.rate,
      secondHalfRate: foldFatigue.secondHalf.rate,
      fatigueDelta: foldFatigue.fatigueDelta,
    });
  }

  leaks.sort((a, b) => b.score - a.score);
  return leaks;
}

// --- Master function ---
export function computePokerInsights(sessionHistory) {
  const hands = getChronologicalPokerHands(sessionHistory);

  const outcomeBreakdown = calcOutcomeBreakdown(hands);
  const returnStats = calcReturnStats(hands);
  const bbStats = calcBBStats(hands);
  const foldStats = calcFoldStats(hands);
  const foldsByStreet = calcFoldsByStreet(hands);
  const postBluffPattern = calcPostBluffPattern(hands);
  const investmentAfterOutcome = calcInvestmentAfterOutcome(hands);
  const streaks = calcStreaks(hands);
  const volatility = calcVolatility(hands);
  const commitmentRatio = calcCommitmentRatio(hands);
  const showdownStats = calcShowdownStats(hands);
  const foldFatigue = calcSessionFoldFatigue(hands);
  const dayOfWeekPerformance = calcDayOfWeekPerformance(sessionHistory, 'Poker');
  const sessionLengthPerformance = calcSessionLengthPerformance(sessionHistory, 'Poker');

  const leaks = buildLeakReport({
    foldStats,
    foldsByStreet,
    postBluffPattern,
    investmentAfterOutcome,
    volatility,
    foldFatigue,
  });

  return {
    totalHands: hands.length,
    outcomeBreakdown,
    returnStats,
    bbStats,
    foldStats,
    foldsByStreet,
    postBluffPattern,
    investmentAfterOutcome,
    streaks,
    volatility,
    commitmentRatio,
    showdownStats,
    foldFatigue,
    dayOfWeekPerformance,
    sessionLengthPerformance,
    leaks,
    topLeak: leaks[0] || null,
  };
}
