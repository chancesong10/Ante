// Pure calculation functions — no React, no UI. Unlike the per-game engines,
// this one deliberately does NOT flatten down to individual hands: a poker
// fold, a blackjack push, and a sports-betting parlay aren't comparable
// events, so there's no honest way to sequence them into one hand-level
// stream. Every stat here operates at the SESSION level instead, where
// "net profit" is the one currency that's uniformly meaningful across
// every game type Ante tracks (including General's simple buy-in/cash-out
// sessions, which have no hand-level detail at all).
const GAME_KEYS = ['Blackjack', 'Poker', 'Sports Betting', 'General'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// sessionHistory is stored newest-first; every stat below wants oldest-first.
export function getAllSessionsChronological(sessionHistory) {
  return sessionHistory.slice().reverse();
}

// --- Per-game breakdown: which game is actually making or costing you
// money, on average per session. Any gameType outside the four Ante
// screens produce falls into "General," matching ProfileScreen's own
// convention. ---
export function calcGameBreakdown(sessions) {
  const groups = {};
  GAME_KEYS.forEach((g) => (groups[g] = []));

  sessions.forEach((s) => {
    const key = GAME_KEYS.includes(s.gameType) ? s.gameType : 'General';
    groups[key].push(s);
  });

  const summarize = (gameType, arr) => {
    const netProfit = arr.reduce((sum, s) => sum + (s.netProfit || 0), 0);
    const wins = arr.reduce((sum, s) => sum + (s.wins || 0), 0);
    const losses = arr.reduce((sum, s) => sum + (s.losses || 0), 0);
    return {
      gameType,
      sessions: arr.length,
      netProfit,
      wins,
      losses,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
      avgNetPerSession: arr.length > 0 ? netProfit / arr.length : null,
    };
  };

  const all = GAME_KEYS.map((g) => summarize(g, groups[g])).filter((g) => g.sessions > 0);
  const eligible = all.filter((g) => g.sessions >= 3);
  const best = eligible.length > 0 ? eligible.reduce((a, b) => (b.avgNetPerSession > a.avgNetPerSession ? b : a)) : null;
  const worst = eligible.length > 0 ? eligible.reduce((a, b) => (b.avgNetPerSession < a.avgNetPerSession ? b : a)) : null;

  return { all, best, worst };
}

// --- Winning/losing streaks measured in whole SESSIONS, not hands — "you're
// on a 5-session losing streak" is a real, cross-game-comparable statement
// in a way hand-level streaks never could be here. ---
export function calcSessionStreaks(sessions) {
  if (sessions.length === 0) {
    return { currentStreakType: null, currentStreakLength: 0, longestWinStreak: 0, longestLossStreak: 0 };
  }
  const typeOf = (s) => {
    const net = s.netProfit || 0;
    if (net > 0) return 'win';
    if (net < 0) return 'loss';
    return null;
  };

  const lastType = typeOf(sessions[sessions.length - 1]);
  let currentStreakLength = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (lastType !== null && typeOf(sessions[i]) === lastType) currentStreakLength++;
    else break;
  }

  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let runType = null;
  let runLength = 0;

  sessions.forEach((s) => {
    const t = typeOf(s);
    if (t !== null) {
      if (t === runType) runLength++;
      else {
        runType = t;
        runLength = 1;
      }
      if (runType === 'win') longestWinStreak = Math.max(longestWinStreak, runLength);
      if (runType === 'loss') longestLossStreak = Math.max(longestLossStreak, runLength);
    } else {
      runType = null;
      runLength = 0;
    }
  });

  return { currentStreakType: lastType, currentStreakLength, longestWinStreak, longestLossStreak };
}

// --- Best/worst day of week, across every game combined. ---
export function calcDayOfWeekPerformance(sessions) {
  const byDay = {};
  DAY_NAMES.forEach((d) => (byDay[d] = { netProfit: 0, sessions: 0 }));

  sessions.forEach((s) => {
    const day = DAY_NAMES[new Date(s.startTime).getDay()];
    byDay[day].netProfit += s.netProfit || 0;
    byDay[day].sessions += 1;
  });

  const withData = Object.entries(byDay)
    .filter(([, v]) => v.sessions > 0)
    .map(([day, v]) => ({ day, avgNet: v.netProfit / v.sessions, sessions: v.sessions }));

  if (withData.length < 2) return null;

  const best = withData.reduce((a, b) => (b.avgNet > a.avgNet ? b : a));
  const worst = withData.reduce((a, b) => (b.avgNet < a.avgNet ? b : a));

  return { best, worst, allDays: withData };
}

// --- Performance by session length, across every game combined. ---
export function calcSessionLengthPerformance(sessions) {
  if (sessions.length < 3) return null;

  const tiers = { short: [], medium: [], long: [] };
  sessions.forEach((s) => {
    const totalHands = s.totalHands || 0;
    if (totalHands <= 10) tiers.short.push(s);
    else if (totalHands <= 25) tiers.medium.push(s);
    else tiers.long.push(s);
  });

  const summarize = (arr) => ({
    sample: arr.length,
    avgNetPerHand:
      arr.length > 0
        ? arr.reduce((sum, s) => sum + (s.netProfit || 0) / (s.totalHands || 1), 0) / arr.length
        : null,
  });

  return { short: summarize(tiers.short), medium: summarize(tiers.medium), long: summarize(tiers.long) };
}

// --- Session-to-session consistency. There's no honest cross-game "average
// bet" to normalize against here, so this uses each session's own typical
// magnitude (mean absolute net profit) as the yardstick instead — a
// coefficient-of-variation read on how consistent your session results
// are, not a bet-relative one like the per-game engines use. ---
function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function calcVolatility(sessions) {
  const netProfits = sessions.map((s) => s.netProfit || 0);
  const avgMagnitude =
    netProfits.length > 0 ? netProfits.reduce((s, v) => s + Math.abs(v), 0) / netProfits.length : 0;
  const netStdDev = stdDev(netProfits);
  const volatilityRatio = avgMagnitude > 0 ? netStdDev / avgMagnitude : null;

  let riskLabel = null;
  if (volatilityRatio !== null) {
    if (volatilityRatio < 1.2) riskLabel = 'Low';
    else if (volatilityRatio < 2.2) riskLabel = 'Moderate';
    else riskLabel = 'High';
  }

  return { netResultStdDev: netStdDev, avgSessionMagnitude: avgMagnitude, volatilityRatio, riskLabel };
}

// --- Total time actually spent playing, across every session. Nowhere
// else in the app totals time — Analytics and Profile only ever total
// money — even though time is a resource too. Sessions missing a valid
// start/end pair (shouldn't happen in practice, but defensively) are
// excluded rather than treated as zero-length. ---
export function calcTimePlayed(sessions) {
  const withDuration = sessions.filter(
    (s) => s.startTime != null && s.endTime != null && s.endTime > s.startTime
  );
  if (withDuration.length === 0) return null;
  const totalMinutes = withDuration.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) / 60000;
  return {
    totalMinutes,
    avgMinutesPerSession: totalMinutes / withDuration.length,
    sample: withDuration.length,
  };
}

// --- Leak detector, same shape as the per-game engines: scans the stats
// already computed for known -EV signatures and ranks whichever clear
// their evidence threshold. `score` is a heuristic 0-100 used only to
// rank leaks against each other. ---
export function buildLeakReport({ gameBreakdown, dayOfWeekPerformance, sessionLengthPerformance, volatility }) {
  const leaks = [];

  if (
    gameBreakdown.worst &&
    gameBreakdown.worst.avgNetPerSession < 0 &&
    (!gameBreakdown.best || gameBreakdown.worst.gameType !== gameBreakdown.best.gameType) &&
    (!gameBreakdown.best || gameBreakdown.worst.avgNetPerSession < gameBreakdown.best.avgNetPerSession - Math.abs(gameBreakdown.best.avgNetPerSession) * 0.5 || gameBreakdown.best.avgNetPerSession <= 0)
  ) {
    leaks.push({
      id: 'worst_game',
      score: Math.min(100, Math.abs(gameBreakdown.worst.avgNetPerSession)),
      gameType: gameBreakdown.worst.gameType,
      sample: gameBreakdown.worst.sessions,
      avgNetPerSession: gameBreakdown.worst.avgNetPerSession,
      bestGameType: gameBreakdown.best ? gameBreakdown.best.gameType : null,
      bestAvgNetPerSession: gameBreakdown.best ? gameBreakdown.best.avgNetPerSession : null,
    });
  }

  if (
    dayOfWeekPerformance &&
    dayOfWeekPerformance.worst.sessions >= 3 &&
    dayOfWeekPerformance.worst.avgNet < 0 &&
    dayOfWeekPerformance.best.avgNet - dayOfWeekPerformance.worst.avgNet > Math.abs(dayOfWeekPerformance.worst.avgNet) * 0.5
  ) {
    leaks.push({
      id: 'day_of_week_drag',
      score: Math.min(100, Math.abs(dayOfWeekPerformance.worst.avgNet)),
      day: dayOfWeekPerformance.worst.day,
      sample: dayOfWeekPerformance.worst.sessions,
      avgNet: dayOfWeekPerformance.worst.avgNet,
      bestDay: dayOfWeekPerformance.best.day,
      bestAvgNet: dayOfWeekPerformance.best.avgNet,
    });
  }

  if (
    sessionLengthPerformance &&
    sessionLengthPerformance.long.sample >= 3 &&
    sessionLengthPerformance.short.sample >= 3 &&
    sessionLengthPerformance.long.avgNetPerHand !== null &&
    sessionLengthPerformance.short.avgNetPerHand !== null &&
    sessionLengthPerformance.long.avgNetPerHand < sessionLengthPerformance.short.avgNetPerHand - Math.abs(sessionLengthPerformance.short.avgNetPerHand) * 0.5
  ) {
    leaks.push({
      id: 'session_length_fatigue',
      score: Math.min(100, Math.abs(sessionLengthPerformance.short.avgNetPerHand - sessionLengthPerformance.long.avgNetPerHand) * 10),
      sampleShort: sessionLengthPerformance.short.sample,
      sampleLong: sessionLengthPerformance.long.sample,
      shortAvgNetPerHand: sessionLengthPerformance.short.avgNetPerHand,
      longAvgNetPerHand: sessionLengthPerformance.long.avgNetPerHand,
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
export function computeLifetimeInsights(sessionHistory) {
  const sessions = getAllSessionsChronological(sessionHistory);

  const totalSessions = sessions.length;
  const netProfit = sessions.reduce((sum, s) => sum + (s.netProfit || 0), 0);
  const wins = sessions.reduce((sum, s) => sum + (s.wins || 0), 0);
  const losses = sessions.reduce((sum, s) => sum + (s.losses || 0), 0);
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;

  const gameBreakdown = calcGameBreakdown(sessions);
  const sessionStreaks = calcSessionStreaks(sessions);
  const dayOfWeekPerformance = calcDayOfWeekPerformance(sessions);
  const sessionLengthPerformance = calcSessionLengthPerformance(sessions);
  const volatility = calcVolatility(sessions);
  const timePlayed = calcTimePlayed(sessions);

  const leaks = buildLeakReport({ gameBreakdown, dayOfWeekPerformance, sessionLengthPerformance, volatility });

  return {
    totalSessions,
    netProfit,
    winRate,
    gameBreakdown,
    sessionStreaks,
    dayOfWeekPerformance,
    sessionLengthPerformance,
    volatility,
    timePlayed,
    leaks,
    topLeak: leaks[0] || null,
  };
}
