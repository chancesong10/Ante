// Pure calculation functions — no React, no UI.

export function getSessionsForGameType(sessionHistory, gameType) {
  return sessionHistory
    .filter((s) => s.gameType === gameType && s.mode === 'hands')
    .slice()
    .reverse(); // oldest first
}

export function getChronologicalHands(sessionHistory, gameType) {
  const sessions = getSessionsForGameType(sessionHistory, gameType);
  const allHands = [];
  sessions.forEach((session) => {
    const chronological = session.hands.slice().reverse();
    chronological.forEach((r) => {
      if (r.type === 'split') {
        allHands.push(...r.hands);
      } else {
        allHands.push(r);
      }
    });
  });
  return allHands;
}

// --- Overall outcome breakdown (the baseline everything else is relative to) ---
export function calcOutcomeBreakdown(hands) {
  const sample = hands.length;
  if (sample === 0) {
    return { wins: 0, losses: 0, pushes: 0, sample: 0, winRate: null, lossRate: null, pushRate: null };
  }
  const wins = hands.filter((h) => h.outcome === 'win').length;
  const losses = hands.filter((h) => h.outcome === 'loss').length;
  const pushes = hands.filter((h) => h.outcome === 'push').length;
  return {
    wins,
    losses,
    pushes,
    sample,
    winRate: (wins / sample) * 100,
    lossRate: (losses / sample) * 100,
    pushRate: (pushes / sample) * 100,
  };
}

// --- Actual money return: accounts for bet size and blackjack's 3:2 payout,
// which a plain win-rate percentage can't capture ---
export function calcReturnStats(hands) {
  const sample = hands.length;
  const totalWagered = hands.reduce(
    (sum, h) => sum + (h.doubled ? (h.bet || 0) * 2 : h.bet || 0),
    0
  );
  const netProfit = hands.reduce((sum, h) => sum + (h.netChange || 0), 0);
  return {
    sample,
    totalWagered,
    netProfit,
    roi: totalWagered > 0 ? (netProfit / totalWagered) * 100 : null,
    avgResultPerHand: sample > 0 ? netProfit / sample : null,
  };
}

// --- How often you double, vs. roughly how often basic strategy calls for it ---
export function calcDoubleDownRate(hands) {
  if (hands.length === 0) return null;
  const doubledCount = hands.filter((h) => h.doubled).length;
  return {
    rate: (doubledCount / hands.length) * 100,
    count: doubledCount,
    sample: hands.length,
    benchmarkRate: 10, // approx. share of hands where basic strategy calls for doubling, 6-deck S17
  };
}

export function calcAverageBet(hands) {
  if (hands.length === 0) return 0;
  return hands.reduce((sum, h) => sum + (h.bet || 0), 0) / hands.length;
}

export function calcMedianBet(hands) {
  if (hands.length === 0) return 0;
  const sorted = hands.map((h) => h.bet || 0).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function calcBetSizeAfterOutcome(hands) {
  const afterWin = [];
  const afterLoss = [];
  for (let i = 1; i < hands.length; i++) {
    const prevOutcome = hands[i - 1].outcome;
    if (prevOutcome === 'win') afterWin.push(hands[i].bet || 0);
    if (prevOutcome === 'loss') afterLoss.push(hands[i].bet || 0);
  }
  const avg = (arr) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  return {
    avgBetAfterWin: avg(afterWin),
    avgBetAfterLoss: avg(afterLoss),
    sampleAfterWin: afterWin.length,
    sampleAfterLoss: afterLoss.length,
  };
}

export function calcStreaks(hands) {
  if (hands.length === 0) {
    return { currentStreakType: null, currentStreakLength: 0, longestWinStreak: 0, longestLossStreak: 0 };
  }
  const lastOutcome = hands[hands.length - 1].outcome;
  let currentStreakLength = 0;
  for (let i = hands.length - 1; i >= 0; i--) {
    if (hands[i].outcome === lastOutcome && (lastOutcome === 'win' || lastOutcome === 'loss')) {
      currentStreakLength++;
    } else break;
  }
  const currentStreakType = lastOutcome === 'push' ? null : lastOutcome;

  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let runType = null;
  let runLength = 0;

  hands.forEach((h) => {
    if (h.outcome === 'win' || h.outcome === 'loss') {
      if (h.outcome === runType) runLength++;
      else { runType = h.outcome; runLength = 1; }
      if (runType === 'win') longestWinStreak = Math.max(longestWinStreak, runLength);
      if (runType === 'loss') longestLossStreak = Math.max(longestLossStreak, runLength);
    } else {
      runType = null;
      runLength = 0;
    }
  });

  return { currentStreakType, currentStreakLength, longestWinStreak, longestLossStreak };
}

// --- NEW: Conditional / Markov-style win rates ---
export function calcConditionalWinRates(hands) {
  const groups = {
    afterWin: { win: 0, loss: 0, push: 0 },
    afterLoss: { win: 0, loss: 0, push: 0 },
    afterTwoWins: { win: 0, loss: 0, push: 0 },
    afterTwoLosses: { win: 0, loss: 0, push: 0 },
  };

  for (let i = 1; i < hands.length; i++) {
    const prev = hands[i - 1].outcome;
    const curr = hands[i].outcome;
    if (prev === 'win') groups.afterWin[curr]++;
    if (prev === 'loss') groups.afterLoss[curr]++;

    if (i >= 2) {
      const prev2 = hands[i - 2].outcome;
      if (prev === 'win' && prev2 === 'win') groups.afterTwoWins[curr]++;
      if (prev === 'loss' && prev2 === 'loss') groups.afterTwoLosses[curr]++;
    }
  }

  const winRate = (g) => {
    const total = g.win + g.loss;
    return { rate: total > 0 ? (g.win / total) * 100 : null, sample: g.win + g.loss + g.push };
  };

  return {
    afterWin: winRate(groups.afterWin),
    afterLoss: winRate(groups.afterLoss),
    afterTwoWins: winRate(groups.afterTwoWins),
    afterTwoLosses: winRate(groups.afterTwoLosses),
  };
}

// --- NEW: Doubling performance ---
export function calcDoublingStats(hands) {
  const doubled = hands.filter((h) => h.doubled);
  const notDoubled = hands.filter((h) => !h.doubled);

  const summarize = (arr) => {
    const wins = arr.filter((h) => h.outcome === 'win').length;
    const losses = arr.filter((h) => h.outcome === 'loss').length;
    const totalStake = arr.reduce((sum, h) => sum + (h.doubled ? h.bet * 2 : h.bet), 0);
    const totalNet = arr.reduce((sum, h) => sum + (h.netChange || 0), 0);
    return {
      sample: arr.length,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
      roi: totalStake > 0 ? (totalNet / totalStake) * 100 : null,
    };
  };

  return {
    doubled: summarize(doubled),
    notDoubled: summarize(notDoubled),
  };
}

// --- NEW: Blackjack (natural) frequency vs expected ---
export function calcBlackjackFrequency(hands) {
  if (hands.length === 0) return { actualRate: 0, expectedRate: 4.8, sample: 0 };
  const blackjackCount = hands.filter((h) => h.blackjack).length;
  return {
    actualRate: (blackjackCount / hands.length) * 100,
    expectedRate: 4.8,
    sample: hands.length,
    count: blackjackCount,
  };
}

// --- NEW: Win rate by bet-size tier (based on the user's own tercile split) ---
export function calcBetTierWinRates(hands) {
  if (hands.length < 6) return null; // not enough for 3 meaningful buckets

  const sortedBets = hands.map((h) => h.bet || 0).sort((a, b) => a - b);
  const tercile1 = sortedBets[Math.floor(sortedBets.length / 3)];
  const tercile2 = sortedBets[Math.floor((sortedBets.length * 2) / 3)];

  const tiers = { small: [], medium: [], large: [] };
  hands.forEach((h) => {
    if (h.bet <= tercile1) tiers.small.push(h);
    else if (h.bet <= tercile2) tiers.medium.push(h);
    else tiers.large.push(h);
  });

  const summarize = (arr) => {
    const wins = arr.filter((h) => h.outcome === 'win').length;
    const losses = arr.filter((h) => h.outcome === 'loss').length;
    return {
      sample: arr.length,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
      avgBet: arr.length > 0 ? arr.reduce((s, h) => s + h.bet, 0) / arr.length : 0,
    };
  };

  return {
    small: summarize(tiers.small),
    medium: summarize(tiers.medium),
    large: summarize(tiers.large),
  };
}

// --- NEW: Risk / volatility scoring ---
function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function calcVolatility(hands) {
  const netChanges = hands.map((h) => h.netChange || 0);
  const betSizes = hands.map((h) => h.bet || 0);
  const avgBet = calcAverageBet(hands);

  const netStdDev = stdDev(netChanges);
  const betStdDev = stdDev(betSizes);
  const volatilityRatio = avgBet > 0 ? netStdDev / avgBet : null;

  let riskLabel = null;
  if (volatilityRatio !== null) {
    if (volatilityRatio < 1.2) riskLabel = 'Low';
    else if (volatilityRatio < 2.2) riskLabel = 'Moderate';
    else riskLabel = 'High';
  }

  return {
    netResultStdDev: netStdDev,
    betSizeStdDev: betStdDev,
    betSizeConsistency: avgBet > 0 ? Math.max(0, 100 - (betStdDev / avgBet) * 100) : null,
    volatilityRatio,
    riskLabel,
  };
}

// --- NEW: Session-level patterns (day of week, session length) ---
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function calcDayOfWeekPerformance(sessionHistory, gameType) {
  const sessions = getSessionsForGameType(sessionHistory, gameType);
  const byDay = {};
  DAY_NAMES.forEach((d) => (byDay[d] = { netProfit: 0, sessions: 0 }));

  sessions.forEach((s) => {
    const day = DAY_NAMES[new Date(s.startTime).getDay()];
    byDay[day].netProfit += s.netProfit;
    byDay[day].sessions += 1;
  });

  const withData = Object.entries(byDay)
    .filter(([, v]) => v.sessions > 0)
    .map(([day, v]) => ({ day, avgNet: v.netProfit / v.sessions, sessions: v.sessions }));

  // Need at least 2 distinct days with data — otherwise "best" and "worst"
  // would just be the same single day, which is confusing, not insightful.
  if (withData.length < 2) return null;

  const best = withData.reduce((a, b) => (b.avgNet > a.avgNet ? b : a));
  const worst = withData.reduce((a, b) => (b.avgNet < a.avgNet ? b : a));

  return { best, worst, allDays: withData };
}

export function calcSessionLengthPerformance(sessionHistory, gameType) {
  const sessions = getSessionsForGameType(sessionHistory, gameType);
  if (sessions.length < 3) return null;

  const tiers = { short: [], medium: [], long: [] };
  sessions.forEach((s) => {
    if (s.totalHands <= 10) tiers.short.push(s);
    else if (s.totalHands <= 25) tiers.medium.push(s);
    else tiers.long.push(s);
  });

  const summarize = (arr) => ({
    sample: arr.length,
    avgNetPerHand:
      arr.length > 0
        ? arr.reduce((sum, s) => sum + s.netProfit / (s.totalHands || 1), 0) / arr.length
        : null,
  });

  return {
    short: summarize(tiers.short),
    medium: summarize(tiers.medium),
    long: summarize(tiers.long),
  };
}

// --- Leak detector, same shape as the poker/sports-betting engines: scans
// the stats already being computed for known -EV signatures and ranks
// whichever clear their evidence threshold. `score` is a heuristic 0-100
// used only to rank leaks against each other, not a probability. Day-of-
// week and session-length are deliberately excluded — they're descriptive
// (and largely outside the player's control), not a fixable leak, and
// blackjack_frequency is pure card-luck, not behavior, so neither is
// leak material here either — consistent with what the poker and sports
// engines treat as in-scope. ---
export function buildLeakReport({ betSizeAfterOutcome, doubleDownRate, doublingStats, betTierWinRates, volatility }) {
  const leaks = [];

  if (
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

  if (doubleDownRate && doubleDownRate.sample >= 15) {
    const diff = doubleDownRate.rate - doubleDownRate.benchmarkRate;
    if (Math.abs(diff) > 5) {
      leaks.push({
        id: diff < 0 ? 'double_down_underuse' : 'double_down_overuse',
        score: Math.min(100, Math.abs(diff) * 6),
        sample: doubleDownRate.sample,
        rate: doubleDownRate.rate,
        benchmarkRate: doubleDownRate.benchmarkRate,
        diff,
      });
    }
  }

  if (
    doublingStats.doubled.sample >= 6 &&
    doublingStats.doubled.roi !== null &&
    doublingStats.doubled.roi < -15 &&
    (doublingStats.notDoubled.roi === null || doublingStats.doubled.roi < doublingStats.notDoubled.roi - 15)
  ) {
    leaks.push({
      id: 'doubling_underperformance',
      score: Math.min(100, Math.abs(doublingStats.doubled.roi)),
      sample: doublingStats.doubled.sample,
      doubledRoi: doublingStats.doubled.roi,
      notDoubledRoi: doublingStats.notDoubled.roi,
    });
  }

  if (
    betTierWinRates &&
    betTierWinRates.small.sample >= 4 &&
    betTierWinRates.large.sample >= 4 &&
    betTierWinRates.small.winRate !== null &&
    betTierWinRates.large.winRate !== null &&
    betTierWinRates.small.winRate - betTierWinRates.large.winRate > 15
  ) {
    leaks.push({
      id: 'bet_tier_dropoff',
      score: Math.min(100, betTierWinRates.small.winRate - betTierWinRates.large.winRate),
      sampleSmall: betTierWinRates.small.sample,
      sampleLarge: betTierWinRates.large.sample,
      smallWinRate: betTierWinRates.small.winRate,
      largeWinRate: betTierWinRates.large.winRate,
    });
  }

  if (volatility.riskLabel === 'High') {
    leaks.push({
      id: 'volatility',
      score: Math.min(100, (volatility.volatilityRatio || 0) * 25),
      volatilityRatio: volatility.volatilityRatio,
    });
  }

  leaks.sort((a, b) => b.score - a.score);
  return leaks;
}

// --- Master function ---
export function computeInsights(sessionHistory, gameType) {
  const hands = getChronologicalHands(sessionHistory, gameType);

  const betSizeAfterOutcome = calcBetSizeAfterOutcome(hands);
  const doubleDownRate = calcDoubleDownRate(hands);
  const doublingStats = calcDoublingStats(hands);
  const betTierWinRates = calcBetTierWinRates(hands);
  const volatility = calcVolatility(hands);

  const leaks = buildLeakReport({
    betSizeAfterOutcome,
    doubleDownRate,
    doublingStats,
    betTierWinRates,
    volatility,
  });

  return {
    totalHands: hands.length,
    outcomeBreakdown: calcOutcomeBreakdown(hands),
    returnStats: calcReturnStats(hands),
    averageBet: calcAverageBet(hands),
    medianBet: calcMedianBet(hands),
    ...betSizeAfterOutcome,
    ...calcStreaks(hands),
    conditionalWinRates: calcConditionalWinRates(hands),
    doublingStats,
    doubleDownRate,
    blackjackFrequency: calcBlackjackFrequency(hands),
    betTierWinRates,
    volatility,
    dayOfWeekPerformance: calcDayOfWeekPerformance(sessionHistory, gameType),
    sessionLengthPerformance: calcSessionLengthPerformance(sessionHistory, gameType),
    leaks,
    topLeak: leaks[0] || null,
  };
}