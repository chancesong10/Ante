// Pure calculation functions — no React, no UI. Reusable later for Markov chain work.

// Pulls all individual hands/bets for one game type, in true chronological order
// (oldest first), across all completed sessions of that type.
export function getChronologicalHands(sessionHistory, gameType) {
  const relevantSessions = sessionHistory
    .filter((s) => s.gameType === gameType && s.mode === 'hands')
    .slice()
    .reverse(); // sessionHistory is newest-first; flip to oldest-first

  const allHands = [];
  relevantSessions.forEach((session) => {
    // session.hands is also newest-first (unshift on log); flip per session too
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

export function calcAverageBet(hands) {
  if (hands.length === 0) return 0;
  const total = hands.reduce((sum, h) => sum + (h.bet || 0), 0);
  return total / hands.length;
}

export function calcMedianBet(hands) {
  if (hands.length === 0) return 0;
  const sorted = hands.map((h) => h.bet || 0).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Average bet size on the hand immediately AFTER a win, vs immediately after a loss.
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

// Current streak (from the most recent hand backwards) and longest streaks ever.
export function calcStreaks(hands) {
  if (hands.length === 0) {
    return { currentStreakType: null, currentStreakLength: 0, longestWinStreak: 0, longestLossStreak: 0 };
  }

  // Current streak: walk backwards from the end
  const lastOutcome = hands[hands.length - 1].outcome;
  let currentStreakLength = 0;
  for (let i = hands.length - 1; i >= 0; i--) {
    if (hands[i].outcome === lastOutcome && (lastOutcome === 'win' || lastOutcome === 'loss')) {
      currentStreakLength++;
    } else {
      break;
    }
  }
  const currentStreakType = lastOutcome === 'push' ? null : lastOutcome;

  // Longest streaks: walk forward once
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let runType = null;
  let runLength = 0;

  hands.forEach((h) => {
    if (h.outcome === 'win' || h.outcome === 'loss') {
      if (h.outcome === runType) {
        runLength++;
      } else {
        runType = h.outcome;
        runLength = 1;
      }
      if (runType === 'win') longestWinStreak = Math.max(longestWinStreak, runLength);
      if (runType === 'loss') longestLossStreak = Math.max(longestLossStreak, runLength);
    } else {
      runType = null;
      runLength = 0;
    }
  });

  return { currentStreakType, currentStreakLength, longestWinStreak, longestLossStreak };
}

// Master function — computes everything InsightsScreen needs in one call.
export function computeInsights(sessionHistory, gameType) {
  const hands = getChronologicalHands(sessionHistory, gameType);

  return {
    totalHands: hands.length,
    averageBet: calcAverageBet(hands),
    medianBet: calcMedianBet(hands),
    ...calcBetSizeAfterOutcome(hands),
    ...calcStreaks(hands),
  };
}