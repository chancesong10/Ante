// Pure calculation functions — no React, no UI. Sports-betting bet records
// share the same {bet, odds, outcome, netChange} shape blackjack/generic
// hands use, so most of the generic machinery in statsEngine.js applies
// unmodified and is re-exported from here rather than duplicated. What's
// genuinely sports-specific — odds-implied edge, favorite/underdog splits,
// bet-type and sport breakdowns, live-vs-pregame — lives in this file.
import {
  getChronologicalHands,
  calcOutcomeBreakdown,
  calcReturnStats,
  calcBetSizeAfterOutcome,
  calcStreaks,
  calcConditionalWinRates,
  calcVolatility,
  calcBetTierWinRates,
  calcDayOfWeekPerformance,
  calcSessionLengthPerformance,
} from './statsEngine';

export {
  calcOutcomeBreakdown,
  calcReturnStats,
  calcBetSizeAfterOutcome,
  calcStreaks,
  calcConditionalWinRates,
  calcVolatility,
  calcBetTierWinRates,
  calcDayOfWeekPerformance,
  calcSessionLengthPerformance,
};

export function getChronologicalBets(sessionHistory) {
  return getChronologicalHands(sessionHistory, 'Sports Betting');
}

// --- American odds -> implied probability, the sportsbook's own price on
// the bet at the moment it was placed. ---
function impliedProbability(americanOdds) {
  if (americanOdds < 0) return -americanOdds / (-americanOdds + 100);
  return 100 / (americanOdds + 100);
}

function summarizeGroup(arr) {
  const decided = arr.filter((h) => h.outcome === 'win' || h.outcome === 'loss');
  const wins = decided.filter((h) => h.outcome === 'win').length;
  const totalStaked = arr.reduce((s, h) => s + (h.bet || 0), 0);
  const netProfit = arr.reduce((s, h) => s + (h.netChange || 0), 0);
  return {
    sample: arr.length,
    winRate: decided.length > 0 ? (wins / decided.length) * 100 : null,
    roi: totalStaked > 0 ? (netProfit / totalStaked) * 100 : null,
    netProfit,
  };
}

// --- The headline "pro metric": are you actually beating the price the
// book gave you, or just winning/losing at the rate your own odds implied?
// A bettor with a 45% actual win rate isn't necessarily bad — if their
// bets averaged 40% implied probability, they're beating the market. This
// is the sports-betting analog to poker's bb/100: raw win rate alone is
// meaningless without the price it was bought at. Pushes are excluded —
// they never resolved a probability either way. ---
export function calcOddsEdge(hands) {
  const decided = hands.filter((h) => h.outcome === 'win' || h.outcome === 'loss');
  if (decided.length === 0) return null;
  const wins = decided.filter((h) => h.outcome === 'win').length;
  const actualWinRate = (wins / decided.length) * 100;
  const avgImpliedProbability =
    (decided.reduce((sum, h) => sum + impliedProbability(h.odds), 0) / decided.length) * 100;
  return {
    sample: decided.length,
    actualWinRate,
    avgImpliedProbability,
    edge: actualWinRate - avgImpliedProbability,
  };
}

// --- Favorite (negative odds) vs. underdog (positive odds) performance. ---
export function calcFavoriteUnderdogStats(hands) {
  const favorites = hands.filter((h) => h.odds < 0);
  const underdogs = hands.filter((h) => h.odds > 0);
  return { favorites: summarizeGroup(favorites), underdogs: summarizeGroup(underdogs) };
}

const BET_TYPE_ORDER = ['Moneyline', 'Spread', 'Total', 'Parlay', 'Prop'];

// --- Win rate / ROI grouped by bet type. Parlays are known to run -EV
// relative to straight bets, so this is usually where the biggest single
// leak shows up if the player logs any. ---
export function calcBetTypeStats(hands) {
  if (hands.length === 0) return [];
  const groups = {};
  hands.forEach((h) => {
    const type = h.betType || 'Other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(h);
  });

  const ordered = BET_TYPE_ORDER.filter((t) => groups[t]).map((t) => ({ type: t, ...summarizeGroup(groups[t]) }));
  const extras = Object.keys(groups)
    .filter((t) => !BET_TYPE_ORDER.includes(t))
    .map((t) => ({ type: t, ...summarizeGroup(groups[t]) }));
  return [...ordered, ...extras];
}

// --- Win rate / ROI grouped by sport/league. Bets logged before the sport
// field existed (or left blank) are excluded rather than dumped into a
// misleading "Other" bucket that mixes real and unknown data. ---
export function calcSportStats(hands) {
  const withSport = hands.filter((h) => h.sport);
  if (withSport.length === 0) return null;

  const groups = {};
  withSport.forEach((h) => {
    if (!groups[h.sport]) groups[h.sport] = [];
    groups[h.sport].push(h);
  });

  const all = Object.keys(groups).map((sport) => ({ sport, ...summarizeGroup(groups[sport]) }));
  const eligible = all.filter((s) => s.sample >= 3 && s.roi !== null);
  const best = eligible.length > 0 ? eligible.reduce((a, b) => (b.roi > a.roi ? b : a)) : null;
  const worst = eligible.length > 0 ? eligible.reduce((a, b) => (b.roi < a.roi ? b : a)) : null;

  return { all, best, worst };
}

// --- Live/in-play vs. pregame betting. Live lines carry more vig and less
// time to think, so this is a well-known leak spot if it's worse. Returns
// null when the player has never logged a live bet — nothing to compare. ---
export function calcLiveVsPregameStats(hands) {
  const live = hands.filter((h) => h.live === true);
  const pregame = hands.filter((h) => h.live !== true);
  if (live.length === 0) return null;
  return { live: summarizeGroup(live), pregame: summarizeGroup(pregame) };
}

// --- Leak detector, same shape as the poker engine's: scans the computed
// stats for known -EV signatures and ranks whichever clear their evidence
// threshold. `score` is a heuristic 0-100 used only to rank leaks against
// each other. ---
export function buildLeakReport({
  oddsEdge,
  favoriteUnderdog,
  betTypeStats,
  liveVsPregame,
  betSizeAfterOutcome,
  volatility,
  returnStats,
}) {
  const leaks = [];

  if (oddsEdge && oddsEdge.sample >= 8 && oddsEdge.edge < -8) {
    leaks.push({
      id: 'negative_edge',
      score: Math.min(100, Math.abs(oddsEdge.edge) * 3),
      sample: oddsEdge.sample,
      edge: oddsEdge.edge,
      actualWinRate: oddsEdge.actualWinRate,
      avgImpliedProbability: oddsEdge.avgImpliedProbability,
    });
  }

  const dog = favoriteUnderdog.underdogs;
  const fav = favoriteUnderdog.favorites;
  if (dog.sample >= 6 && dog.roi !== null && dog.roi < -15 && (fav.roi === null || dog.roi < fav.roi - 15)) {
    leaks.push({
      id: 'favorite_longshot_bias',
      score: Math.min(100, Math.abs(dog.roi)),
      sample: dog.sample,
      underdogRoi: dog.roi,
      favoriteRoi: fav.roi,
    });
  }

  const parlay = betTypeStats.find((b) => b.type === 'Parlay');
  if (
    parlay &&
    parlay.sample >= 4 &&
    parlay.roi !== null &&
    parlay.roi < -10 &&
    (returnStats.roi === null || parlay.roi < returnStats.roi - 10)
  ) {
    leaks.push({
      id: 'parlay_leak',
      score: Math.min(100, Math.abs(parlay.roi)),
      sample: parlay.sample,
      parlayRoi: parlay.roi,
      overallRoi: returnStats.roi,
    });
  }

  const otherTypes = betTypeStats.filter((b) => b.type !== 'Parlay' && b.sample >= 4 && b.roi !== null);
  if (otherTypes.length > 0) {
    const worst = otherTypes.reduce((a, b) => (b.roi < a.roi ? b : a));
    if (worst.roi < -10 && (returnStats.roi === null || worst.roi < returnStats.roi - 10)) {
      leaks.push({
        id: 'worst_bet_type',
        score: Math.min(100, Math.abs(worst.roi)),
        sample: worst.sample,
        betType: worst.type,
        roi: worst.roi,
        overallRoi: returnStats.roi,
      });
    }
  }

  if (
    liveVsPregame &&
    liveVsPregame.live.sample >= 4 &&
    liveVsPregame.live.roi !== null &&
    liveVsPregame.pregame.roi !== null &&
    liveVsPregame.live.roi < liveVsPregame.pregame.roi - 15
  ) {
    leaks.push({
      id: 'live_betting_leak',
      score: Math.min(100, liveVsPregame.pregame.roi - liveVsPregame.live.roi),
      sample: liveVsPregame.live.sample,
      liveRoi: liveVsPregame.live.roi,
      pregameRoi: liveVsPregame.pregame.roi,
    });
  }

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
export function computeSportsInsights(sessionHistory) {
  const hands = getChronologicalBets(sessionHistory);

  const outcomeBreakdown = calcOutcomeBreakdown(hands);
  const returnStats = calcReturnStats(hands);
  const oddsEdge = calcOddsEdge(hands);
  const favoriteUnderdog = calcFavoriteUnderdogStats(hands);
  const betTypeStats = calcBetTypeStats(hands);
  const sportStats = calcSportStats(hands);
  const liveVsPregame = calcLiveVsPregameStats(hands);
  const betSizeAfterOutcome = calcBetSizeAfterOutcome(hands);
  const streaks = calcStreaks(hands);
  const conditionalWinRates = calcConditionalWinRates(hands);
  const volatility = calcVolatility(hands);
  const betTierWinRates = calcBetTierWinRates(hands);
  const dayOfWeekPerformance = calcDayOfWeekPerformance(sessionHistory, 'Sports Betting');
  const sessionLengthPerformance = calcSessionLengthPerformance(sessionHistory, 'Sports Betting');

  const leaks = buildLeakReport({
    oddsEdge,
    favoriteUnderdog,
    betTypeStats,
    liveVsPregame,
    betSizeAfterOutcome,
    volatility,
    returnStats,
  });

  return {
    totalHands: hands.length,
    outcomeBreakdown,
    returnStats,
    oddsEdge,
    favoriteUnderdog,
    betTypeStats,
    sportStats,
    liveVsPregame,
    betSizeAfterOutcome,
    streaks,
    conditionalWinRates,
    volatility,
    betTierWinRates,
    dayOfWeekPerformance,
    sessionLengthPerformance,
    leaks,
    topLeak: leaks[0] || null,
  };
}
