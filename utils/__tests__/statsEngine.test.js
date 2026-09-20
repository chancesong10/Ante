import {
  getSessionsForGameType,
  calcHourlyRateForGame,
  getChronologicalHands,
  calcOutcomeBreakdown,
  calcReturnStats,
  calcDoubleDownRate,
  calcBetSizeAfterOutcome,
  calcStreaks,
  calcConditionalWinRates,
  calcDoublingStats,
  calcBlackjackFrequency,
  calcBetTierWinRates,
  calcVolatility,
  calcDayOfWeekPerformance,
  calcSessionLengthPerformance,
  buildLeakReport,
  computeInsights,
} from '../statsEngine';
import { calcHourlyRate } from '../sessionPatterns';

// ---------------------------------------------------------------------
// These tests deliberately construct hand sequences where the "correct"
// answer is known in advance — a martingale ladder, a forced win/loss
// streak, tied bet sizes — rather than feeding the engine plausible
// but arbitrary data. That way a wrong number is a real defect, not a
// judgment call. See reports/blackjack-insights-audit.pdf for the full
// write-up this file was derived from.
// ---------------------------------------------------------------------

// Mirrors calcBlackjackNet (utils/blackjackStrategy.js) at a 3:2 table, so
// mock hands carry realistic netChange values the same way the real UI does.
function calcNet(bet, doubledFlag, blackjackFlag, outcomeVal) {
  const stake = doubledFlag ? bet * 2 : bet;
  if (outcomeVal === 'win') return blackjackFlag ? stake * 1.5 : stake;
  if (outcomeVal === 'loss') return -stake;
  return 0;
}

function hand({ bet, doubled = false, blackjack = false, outcome }) {
  return {
    type: 'single',
    bet,
    doubled,
    blackjack,
    outcome,
    netChange: calcNet(bet, doubled, blackjack, outcome),
  };
}

// Builds a session the way SessionContext/storageService actually store
// it: hands newest-first (unshift order). getChronologicalHands reverses
// this internally, so callers of this helper can think in plain
// chronological order and let this function compensate.
function makeSession({ hands, gameType = 'Blackjack', startTime, id }) {
  const totalHands = hands.length;
  const netProfit = hands.reduce((s, h) => s + (h.netChange || 0), 0);
  return {
    id: id || Math.random().toString(36).slice(2),
    gameType,
    mode: 'hands',
    startTime: startTime || new Date().toISOString(),
    totalHands,
    netProfit,
    hands: hands.slice().reverse(),
  };
}

// sessionHistory itself is also stored newest-first.
function historyFromSessions(sessions) {
  return sessions.slice().reverse();
}

describe('1. Streak Detection', () => {
  test('captures longest win/loss streaks and current streak from a known W/L pattern', () => {
    const pattern = ['win', 'win', 'win', 'loss', 'loss', 'win', 'win', 'win', 'win', 'loss'];
    const hands = pattern.map((outcome) => hand({ bet: 25, outcome }));
    const streaks = calcStreaks(hands);

    expect(streaks.longestWinStreak).toBe(4);
    expect(streaks.longestLossStreak).toBe(2);
    expect(streaks.currentStreakType).toBe('loss');
    expect(streaks.currentStreakLength).toBe(1);
  });
});

describe('2. Martingale Bet-Chasing Pattern', () => {
  test('flags avgBetAfterLoss >> avgBetAfterWin under a double-after-loss, reset-after-win ladder', () => {
    const seq = [
      { bet: 10, outcome: 'loss' },
      { bet: 20, outcome: 'loss' },
      { bet: 40, outcome: 'win' },
      { bet: 10, outcome: 'loss' },
      { bet: 20, outcome: 'win' },
      { bet: 10, outcome: 'loss' },
      { bet: 20, outcome: 'loss' },
      { bet: 40, outcome: 'loss' },
      { bet: 80, outcome: 'win' },
      { bet: 10, outcome: 'win' },
    ];
    const hands = seq.map((h) => hand(h));
    const bso = calcBetSizeAfterOutcome(hands);

    expect(bso.avgBetAfterWin).toBeCloseTo(10, 2);
    expect(bso.avgBetAfterLoss).toBeCloseTo((20 + 40 + 20 + 20 + 40 + 80) / 6, 2);
    expect(bso.avgBetAfterLoss).toBeGreaterThan(bso.avgBetAfterWin);
  });
});

describe('3. Flat, Disciplined Bettor', () => {
  test('shows equal bet size after wins and losses, and perfect sizing consistency', () => {
    const pattern = ['win', 'loss', 'win', 'win', 'loss', 'loss', 'win', 'loss', 'win', 'win'];
    const hands = pattern.map((outcome) => hand({ bet: 25, outcome }));
    const bso = calcBetSizeAfterOutcome(hands);
    const vol = calcVolatility(hands);

    expect(bso.avgBetAfterWin).toBeCloseTo(25, 2);
    expect(bso.avgBetAfterLoss).toBeCloseTo(25, 2);
    expect(vol.betSizeConsistency).toBeCloseTo(100, 2);
  });
});

describe('4. Injected Streak Dependency', () => {
  test('detects a large afterTwoLosses vs afterTwoWins gap when outcomes are actually clustered', () => {
    const block = (outcome, n) => Array.from({ length: n }, () => outcome);
    const pattern = [...block('loss', 5), ...block('win', 5), ...block('loss', 5), ...block('win', 5)];
    const hands = pattern.map((outcome) => hand({ bet: 25, outcome }));
    const cwr = calcConditionalWinRates(hands);

    expect(cwr.afterTwoLosses.rate).toBeCloseTo(25, 1);
    expect(cwr.afterTwoWins.rate).toBeCloseTo(85.71, 1);
    expect(cwr.afterTwoWins.rate - cwr.afterTwoLosses.rate).toBeGreaterThan(40);
  });
});

describe('4b. Anti-Correlated and Independent Controls', () => {
  test('strict W/L alternation is correctly read as perfect anti-correlation, not "no pattern"', () => {
    const altPattern = ['win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss'];
    const altHands = altPattern.map((outcome) => hand({ bet: 25, outcome }));
    const altCwr = calcConditionalWinRates(altHands);

    expect(altCwr.afterWin.rate).toBe(0);
    expect(altCwr.afterLoss.rate).toBe(100);
  });

  test('an unpatterned pseudo-random shuffle at a ~50% baseline shows only a small afterWin/afterLoss gap', () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const randomPattern = Array.from({ length: 200 }, () => (rand() < 0.5 ? 'win' : 'loss'));
    const randomHands = randomPattern.map((outcome) => hand({ bet: 25, outcome }));
    const randomCwr = calcConditionalWinRates(randomHands);
    const gap = Math.abs(randomCwr.afterWin.rate - randomCwr.afterLoss.rate);

    expect(gap).toBeLessThan(15);
  });
});

describe('5. Doubling Performance', () => {
  test('separates doubled vs. non-doubled buckets and computes ROI on total stake risked', () => {
    const doubledHands = Array.from({ length: 5 }, () => hand({ bet: 20, doubled: true, outcome: 'win' }));
    const notDoubled = [
      ...Array.from({ length: 4 }, () => hand({ bet: 20, outcome: 'win' })),
      ...Array.from({ length: 6 }, () => hand({ bet: 20, outcome: 'loss' })),
    ];
    const hands = [...doubledHands, ...notDoubled];
    const dbl = calcDoublingStats(hands);
    const ddr = calcDoubleDownRate(hands);

    expect(dbl.doubled.winRate).toBeCloseTo(100, 2);
    expect(dbl.doubled.roi).toBeCloseTo(100, 2);
    expect(dbl.notDoubled.winRate).toBeCloseTo(40, 2);
    expect(dbl.notDoubled.roi).toBeCloseTo(-20, 2);
    expect(ddr.rate).toBeCloseTo(33.33, 1);
  });
});

describe('6. Natural Blackjack Frequency', () => {
  test('reads an elevated natural rate against the 4.8% baseline when hot', () => {
    const hot = [
      ...Array.from({ length: 10 }, () => hand({ bet: 20, blackjack: true, outcome: 'win' })),
      ...Array.from({ length: 90 }, () => hand({ bet: 20, outcome: 'win' })),
    ];
    const bjHot = calcBlackjackFrequency(hot);

    expect(bjHot.actualRate).toBeCloseTo(10, 2);
    expect(bjHot.actualRate).toBeGreaterThan(bjHot.expectedRate);
  });

  test('reads a zero natural rate when cold', () => {
    const cold = Array.from({ length: 50 }, () => hand({ bet: 20, outcome: 'win' }));
    const bjCold = calcBlackjackFrequency(cold);

    expect(bjCold.actualRate).toBe(0);
    expect(bjCold.count).toBe(0);
  });
});

describe('7. Bet-Size Tiering', () => {
  test('splits three clean bet levels using tercile cutoffs', () => {
    const mkGroup = (bet, wins, losses) => [
      ...Array.from({ length: wins }, () => hand({ bet, outcome: 'win' })),
      ...Array.from({ length: losses }, () => hand({ bet, outcome: 'loss' })),
    ];
    const small = mkGroup(10, 2, 6); // 25% win rate
    const medium = mkGroup(50, 4, 4); // 50% win rate
    const large = mkGroup(200, 6, 2); // 75% win rate
    const hands = [...small, ...medium, ...large];

    const tiers = calcBetTierWinRates(hands);
    const uniqueBets = [...new Set(hands.map((h) => h.bet))].sort((a, b) => a - b);
    const tercile1 = uniqueBets[Math.floor(uniqueBets.length / 3)];
    const tercile2 = uniqueBets[Math.floor((uniqueBets.length * 2) / 3)];

    expect(tercile1).toBe(50);
    expect(tercile2).toBe(200);

    // Fixed: terciles come from distinct bet values, and the boundary is
    // strict (`<`) with "large" catching the remainder (`>=`), so each of
    // the three clean bet levels stays in its own bucket instead of $10
    // and $50 merging together. See reports/blackjack-insights-audit.pdf,
    // Finding #1, for the bug this replaced.
    expect(tiers.small.sample).toBe(8);
    expect(tiers.small.winRate).toBeCloseTo(25, 2);
    expect(tiers.medium.sample).toBe(8);
    expect(tiers.medium.winRate).toBeCloseTo(50, 2);
    expect(tiers.large.sample).toBe(8);
    expect(tiers.large.winRate).toBeCloseTo(75, 2);
  });

  test('a concentration of tied bets at a low value no longer gets swallowed into "large"', () => {
    // 20 hands at $25 (the common case), 4 hands at $500 — a tie-heavy
    // distribution that previously could collapse small AND medium into
    // empty buckets and dump everyone into "large."
    const common = Array.from({ length: 20 }, (_, i) => hand({ bet: 25, outcome: i % 2 === 0 ? 'win' : 'loss' }));
    const outliers = Array.from({ length: 4 }, () => hand({ bet: 500, outcome: 'win' }));
    const tiers = calcBetTierWinRates([...common, ...outliers]);

    expect(tiers.small.sample).toBe(0); // nobody bet below the $25 floor — legitimately empty
    expect(tiers.medium.sample).toBe(20);
    expect(tiers.large.sample).toBe(4);
  });

  test('control: non-tied bet sizes split into 3 non-degenerate buckets', () => {
    const bets = [5, 8, 12, 15, 18, 22, 30, 45, 60, 90, 120, 180];
    const outcomes = ['win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss'];
    const hands = bets.map((bet, i) => hand({ bet, outcome: outcomes[i] }));
    const tiers = calcBetTierWinRates(hands);

    expect(tiers.small.sample).toBeGreaterThan(0);
    expect(tiers.medium.sample).toBeGreaterThan(0);
    expect(tiers.large.sample).toBeGreaterThan(0);
  });
});

describe('8. Volatility Scoring', () => {
  test('classifies a bet-size spike as High risk', () => {
    const wildBets = [10, 10, 10, 10, 10, 10, 10, 10, 10, 500];
    const wildOutcomes = ['win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss'];
    const wildHands = wildBets.map((bet, i) => hand({ bet, outcome: wildOutcomes[i] }));
    const volHigh = calcVolatility(wildHands);

    expect(volHigh.riskLabel).toBe('High');
  });

  test('classifies constant bet sizing as Low risk', () => {
    const flatHands = Array.from({ length: 10 }, (_, i) => hand({ bet: 25, outcome: i % 2 === 0 ? 'win' : 'loss' }));
    const volLow = calcVolatility(flatHands);

    expect(volLow.riskLabel).toBe('Low');
  });
});

describe('9. Day-of-Week Pattern', () => {
  test('identifies the best and worst days from sessions engineered to differ by day', () => {
    // 2026 calendar reference: Jan 5 = Monday, Jan 9 = Friday, Jan 12 = Monday, Jan 16 = Friday
    const mondaySessions = [
      makeSession({ hands: [hand({ bet: 50, outcome: 'win' }), hand({ bet: 50, outcome: 'win' })], startTime: '2026-01-05T18:00:00Z' }),
      makeSession({ hands: [hand({ bet: 50, outcome: 'win' }), hand({ bet: 50, outcome: 'win' })], startTime: '2026-01-12T18:00:00Z' }),
    ];
    const fridaySessions = [
      makeSession({ hands: [hand({ bet: 50, outcome: 'loss' }), hand({ bet: 50, outcome: 'loss' })], startTime: '2026-01-09T18:00:00Z' }),
      makeSession({ hands: [hand({ bet: 50, outcome: 'loss' }), hand({ bet: 50, outcome: 'loss' })], startTime: '2026-01-16T18:00:00Z' }),
    ];
    const sessionHistory = historyFromSessions([...mondaySessions, ...fridaySessions]);
    const dow = calcDayOfWeekPerformance(sessionHistory, 'Blackjack');

    expect(dow.best.day).toBe('Monday');
    expect(dow.best.avgNet).toBeCloseTo(100, 2);
    expect(dow.worst.day).toBe('Friday');
    expect(dow.worst.avgNet).toBeCloseTo(-100, 2);
  });
});

describe('10. Session-Length Pattern', () => {
  test('detects a tilt signature: short sessions profitable, long sessions bleeding money', () => {
    const shortSessions = Array.from({ length: 3 }, () =>
      makeSession({ hands: Array.from({ length: 5 }, () => hand({ bet: 20, outcome: 'win' })) })
    );
    const longSessions = Array.from({ length: 3 }, () =>
      makeSession({ hands: Array.from({ length: 30 }, () => hand({ bet: 20, outcome: 'loss' })) })
    );
    const sessionHistory = historyFromSessions([...shortSessions, ...longSessions]);
    const lenPerf = calcSessionLengthPerformance(sessionHistory, 'Blackjack');

    expect(lenPerf.short.avgNetPerHand).toBeCloseTo(20, 2);
    expect(lenPerf.long.avgNetPerHand).toBeCloseTo(-20, 2);
  });
});

describe('11. Split-Hand Flattening', () => {
  test('expands a split record into 2 hands in the correct chronological position', () => {
    const singleBefore = hand({ bet: 25, outcome: 'win' });
    const splitRecord = {
      id: 'split-1',
      type: 'split',
      hands: [hand({ bet: 30, outcome: 'win' }), hand({ bet: 30, outcome: 'loss' })],
    };
    const singleAfter = hand({ bet: 25, outcome: 'loss' });

    const session = makeSession({ hands: [singleBefore, splitRecord, singleAfter] });
    const sessionHistory = historyFromSessions([session]);
    const chron = getChronologicalHands(sessionHistory, 'Blackjack');

    expect(chron).toHaveLength(4);
    expect(chron.map((h) => `${h.bet}/${h.outcome}`)).toEqual(['25/win', '30/win', '30/loss', '25/loss']);
  });
});

describe('12. Minimum-Sample Guard Clauses', () => {
  test('returns null (not a misleading stat) below each function\'s stated sample floor', () => {
    expect(calcOutcomeBreakdown([]).sample).toBe(0);
    expect(calcOutcomeBreakdown([]).winRate).toBeNull();

    expect(calcBetTierWinRates([hand({ bet: 10, outcome: 'win' }), hand({ bet: 20, outcome: 'loss' })])).toBeNull();

    const oneDaySessionHistory = historyFromSessions([
      makeSession({ hands: [hand({ bet: 10, outcome: 'win' })], startTime: '2026-01-05T18:00:00Z' }),
    ]);
    expect(calcDayOfWeekPerformance(oneDaySessionHistory, 'Blackjack')).toBeNull();

    const twoSessionHistory = historyFromSessions([
      makeSession({ hands: [hand({ bet: 10, outcome: 'win' })] }),
      makeSession({ hands: [hand({ bet: 10, outcome: 'loss' })] }),
    ]);
    expect(calcSessionLengthPerformance(twoSessionHistory, 'Blackjack')).toBeNull();
  });
});

describe('13. Payout Math (3:2 blackjack and doubling)', () => {
  test('computes netChange correctly for doubled wins, natural blackjacks, losses, and pushes', () => {
    const doubledWin = hand({ bet: 100, doubled: true, blackjack: false, outcome: 'win' });
    const naturalBJ = hand({ bet: 100, doubled: false, blackjack: true, outcome: 'win' });
    const plainLoss = hand({ bet: 100, doubled: false, blackjack: false, outcome: 'loss' });
    const push = hand({ bet: 100, doubled: false, blackjack: false, outcome: 'push' });

    expect(doubledWin.netChange).toBe(200);
    expect(naturalBJ.netChange).toBe(150);
    expect(plainLoss.netChange).toBe(-100);
    expect(push.netChange).toBe(0);
  });

  test('aggregates totalWagered, netProfit, and ROI across a mixed set of hands', () => {
    const hands = [
      hand({ bet: 100, doubled: true, blackjack: false, outcome: 'win' }), // +200, staked 200
      hand({ bet: 100, doubled: false, blackjack: true, outcome: 'win' }), // +150, staked 100
      hand({ bet: 100, doubled: false, blackjack: false, outcome: 'loss' }), // -100, staked 100
      hand({ bet: 100, doubled: false, blackjack: false, outcome: 'push' }), // 0, staked 100
    ];
    const ret = calcReturnStats(hands);
    const expectedWagered = 200 + 100 + 100 + 100;
    const expectedNet = 200 + 150 - 100 + 0;

    expect(ret.totalWagered).toBe(expectedWagered);
    expect(ret.netProfit).toBe(expectedNet);
    expect(ret.roi).toBeCloseTo((expectedNet / expectedWagered) * 100, 2);
  });
});

describe('14. computeInsights End-to-End Smoke Test', () => {
  test('runs without throwing and stays internally consistent on a large mixed dataset', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const outcomesPool = ['win', 'loss', 'loss', 'push'];
    const bigHands = Array.from({ length: 40 }, () => {
      const bet = [10, 25, 50][Math.floor(rand() * 3)];
      const outcome = outcomesPool[Math.floor(rand() * outcomesPool.length)];
      const doubled = rand() < 0.15;
      const blackjack = outcome === 'win' && rand() < 0.05;
      return hand({ bet, doubled, blackjack, outcome });
    });
    const session = makeSession({ hands: bigHands, startTime: '2026-02-03T20:00:00Z' });
    const sessionHistory = historyFromSessions([session, session, session]);

    let stats;
    expect(() => {
      stats = computeInsights(sessionHistory, 'Blackjack');
    }).not.toThrow();

    expect(stats.totalHands).toBe(stats.outcomeBreakdown.sample);
    expect(
      stats.outcomeBreakdown.wins + stats.outcomeBreakdown.losses + stats.outcomeBreakdown.pushes
    ).toBe(stats.totalHands);
  });
});

describe('15. Leak Detector', () => {
  const noVolatility = { riskLabel: 'Low' };
  const emptyBetSizeAfterOutcome = { sampleAfterWin: 0, sampleAfterLoss: 0, avgBetAfterWin: 0, avgBetAfterLoss: 0 };
  const emptyDoublingStats = { doubled: { sample: 0, roi: null }, notDoubled: { sample: 0, roi: null } };

  test('flags loss_chasing when post-loss bet size clearly outpaces post-win', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: { sampleAfterWin: 5, sampleAfterLoss: 5, avgBetAfterWin: 10, avgBetAfterLoss: 25 },
      doubleDownRate: null,
      doublingStats: emptyDoublingStats,
      betTierWinRates: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('loss_chasing');
    expect(leaks.find((l) => l.id === 'loss_chasing').pctIncrease).toBeCloseTo(150, 2);
  });

  test('flags double_down_underuse when doubling rate sits well below the basic-strategy benchmark', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      doubleDownRate: { rate: 2, benchmarkRate: 10, sample: 50, count: 1 },
      doublingStats: emptyDoublingStats,
      betTierWinRates: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('double_down_underuse');
  });

  test('flags double_down_overuse when doubling rate sits well above the basic-strategy benchmark', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      doubleDownRate: { rate: 22, benchmarkRate: 10, sample: 50, count: 11 },
      doublingStats: emptyDoublingStats,
      betTierWinRates: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('double_down_overuse');
  });

  test('does not flag doubling deviation under a small sample, even at an extreme rate', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      doubleDownRate: { rate: 50, benchmarkRate: 10, sample: 4, count: 2 },
      doublingStats: emptyDoublingStats,
      betTierWinRates: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).not.toContain('double_down_overuse');
  });

  test('flags doubling_underperformance when doubled ROI is deeply negative vs. not-doubled', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      doubleDownRate: null,
      doublingStats: { doubled: { sample: 8, roi: -40 }, notDoubled: { sample: 40, roi: 5 } },
      betTierWinRates: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('doubling_underperformance');
  });

  test('flags bet_tier_dropoff when win rate falls sharply on the largest bets', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      doubleDownRate: null,
      doublingStats: emptyDoublingStats,
      betTierWinRates: {
        small: { sample: 10, winRate: 55, avgBet: 10 },
        medium: { sample: 10, winRate: 48, avgBet: 50 },
        large: { sample: 10, winRate: 30, avgBet: 200 },
      },
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('bet_tier_dropoff');
  });

  test('flags volatility on a High risk label', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      doubleDownRate: null,
      doublingStats: emptyDoublingStats,
      betTierWinRates: null,
      volatility: { riskLabel: 'High', volatilityRatio: 3 },
    });
    expect(leaks.map((l) => l.id)).toContain('volatility');
  });

  test('flags nothing when every input is clean', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: { sampleAfterWin: 10, sampleAfterLoss: 10, avgBetAfterWin: 20, avgBetAfterLoss: 20 },
      doubleDownRate: { rate: 11, benchmarkRate: 10, sample: 50, count: 5 },
      doublingStats: { doubled: { sample: 10, roi: 8 }, notDoubled: { sample: 40, roi: 2 } },
      betTierWinRates: {
        small: { sample: 10, winRate: 48, avgBet: 10 },
        medium: { sample: 10, winRate: 46, avgBet: 50 },
        large: { sample: 10, winRate: 45, avgBet: 200 },
      },
      volatility: noVolatility,
    });
    expect(leaks).toHaveLength(0);
  });

  test('ranks multiple triggered leaks by descending score', () => {
    const leaks = buildLeakReport({
      betSizeAfterOutcome: { sampleAfterWin: 5, sampleAfterLoss: 5, avgBetAfterWin: 10, avgBetAfterLoss: 12 },
      doubleDownRate: null,
      doublingStats: emptyDoublingStats,
      betTierWinRates: null,
      volatility: { riskLabel: 'High', volatilityRatio: 3 },
    });
    expect(leaks.length).toBe(2);
    expect(leaks[0].score).toBeGreaterThanOrEqual(leaks[1].score);
  });

  test('computeInsights exposes leaks/topLeak and stays consistent on a loss-chasing dataset', () => {
    // Alternating win/loss so every "after a win" bet is small (10) and
    // every "after a loss" bet is tripled (30) — 5 samples in each bucket,
    // clearing buildLeakReport's >=4-per-bucket evidence threshold.
    const outcomes = ['win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss', 'win'];
    const bets = [10, 10, 30, 10, 30, 10, 30, 10, 30, 10, 30];
    const hands = outcomes.map((outcome, i) => hand({ bet: bets[i], outcome }));
    const session = makeSession({ hands });
    const sessionHistory = historyFromSessions([session]);
    const stats = computeInsights(sessionHistory, 'Blackjack');

    expect(Array.isArray(stats.leaks)).toBe(true);
    expect(stats.topLeak).not.toBeNull();
    expect(stats.topLeak.id).toBe('loss_chasing');
    expect(stats.topLeak).toBe(stats.leaks[0]);
  });
});

// getSessionsForGameType memoises its per-game slice on the identity of the
// history array it is handed, because every compute*Insights entry point asks
// for the same slice three or four times over. These pin the two ways that
// cache could be wrong: serving one game's sessions for another, and serving
// stale data after history changes.
describe('16. Per-game session cache', () => {
  const bjHands = [hand({ bet: 10, outcome: 'win' }), hand({ bet: 10, outcome: 'loss' })];
  const pokerHands = [
    { gameType: 'Poker', outcome: 'win', netChange: 40, heroInvestment: 10, pot: 50 },
  ];

  test('keeps games apart on the same history array', () => {
    const history = historyFromSessions([
      makeSession({ hands: bjHands, id: 'bj' }),
      makeSession({ hands: pokerHands, gameType: 'Poker', id: 'pk' }),
    ]);

    expect(getChronologicalHands(history, 'Blackjack')).toHaveLength(2);
    expect(getChronologicalHands(history, 'Poker')).toHaveLength(1);
    // Asked again, now that both are cached, each still gets its own.
    expect(getChronologicalHands(history, 'Blackjack')).toHaveLength(2);
    expect(getChronologicalHands(history, 'Poker')).toHaveLength(1);
    expect(getChronologicalHands(history, 'Roulette')).toHaveLength(0);
  });

  test('a new history array is new data, not a cache hit', () => {
    const first = historyFromSessions([makeSession({ hands: bjHands, id: 'one' })]);
    expect(getChronologicalHands(first, 'Blackjack')).toHaveLength(2);

    // What SessionContext does on every change: replace the array wholesale.
    const second = [...first, makeSession({ hands: bjHands, id: 'two' })];
    expect(getChronologicalHands(second, 'Blackjack')).toHaveLength(4);
    // And the original array still answers for itself.
    expect(getChronologicalHands(first, 'Blackjack')).toHaveLength(2);
  });

  // The cached slice is shared with every other caller, so the read-only
  // contract is enforced rather than documented. This pins that: a caller that
  // sorts it in place should fail loudly at its own line instead of quietly
  // reordering what the day-of-week and session-length scans go on to read.
  test('the cached slice is frozen, so an in-place sort throws', () => {
    // Two sessions, deliberately: sorting a one-element array writes nothing,
    // so it cannot throw. Freezing catches the mutations that actually would
    // have reordered the shared copy, which is exactly the harmful case.
    const history = historyFromSessions([
      makeSession({ hands: bjHands, id: 'frozen-a', startTime: 1 }),
      makeSession({ hands: bjHands, id: 'frozen-b', startTime: 2 }),
    ]);
    const sessions = getSessionsForGameType(history, 'Blackjack');
    expect(sessions).toHaveLength(2);
    expect(Object.isFrozen(sessions)).toBe(true);
    expect(() => sessions.sort((a, b) => a.id.localeCompare(b.id) * -1)).toThrow();
    expect(() => sessions.push({})).toThrow();
    // Only the list is frozen. The session records inside are the same objects
    // the rest of the app holds, and freezing those would be a far wider claim.
    expect(Object.isFrozen(sessions[0])).toBe(false);
  });

  test('computeInsights agrees with itself across repeated calls', () => {
    const history = historyFromSessions([makeSession({ hands: bjHands })]);
    const a = computeInsights(history, 'Blackjack');
    const b = computeInsights(history, 'Blackjack');
    expect(b.totalHands).toBe(a.totalHands);
    expect(b.returnStats.netProfit).toBe(a.returnStats.netProfit);
  });
});

// The poker insights screen used to compute its hourly figures over the whole
// of sessionHistory, so "BB/Hour" divided poker big blinds by hours spent at
// every game. These pin the scoping, since a wrong scope produces a plausible
// number rather than an obvious failure.
describe('17. Hourly rate scoping', () => {
  const HOUR = 3600000;

  // Two hours of blackjack at -$100, one hour of poker at +$60.
  const mixedHistory = () =>
    historyFromSessions([
      {
        ...makeSession({ hands: [hand({ bet: 50, outcome: 'loss' })], id: 'bj' }),
        startTime: 0,
        endTime: 2 * HOUR,
        netProfit: -100,
      },
      {
        ...makeSession({ hands: [hand({ bet: 30, outcome: 'win' })], gameType: 'Poker', id: 'pk' }),
        startTime: 10 * HOUR,
        endTime: 11 * HOUR,
        netProfit: 60,
      },
    ]);

  test('per-game rate counts only that game’s hours and net', () => {
    const poker = calcHourlyRateForGame(mixedHistory(), 'Poker');
    expect(poker.totalHours).toBe(1);
    expect(poker.hourlyRate).toBe(60);

    const blackjack = calcHourlyRateForGame(mixedHistory(), 'Blackjack');
    expect(blackjack.totalHours).toBe(2);
    expect(blackjack.hourlyRate).toBe(-50);
  });

  test('the lifetime rate counts every game', () => {
    const all = calcHourlyRate(mixedHistory());
    expect(all.totalHours).toBe(3);
    // -100 + 60 over 3 hours.
    expect(all.hourlyRate).toBeCloseTo(-40 / 3, 10);
  });

  // Below a few minutes the divisor is noise, so no rate is reported at all
  // rather than "+$4,182/hr" off one lucky two-minute session.
  test('too little time played reports no rate, but still reports the hours', () => {
    const brief = historyFromSessions([
      {
        ...makeSession({ hands: [hand({ bet: 10, outcome: 'win' })], id: 'brief' }),
        startTime: 0,
        endTime: 60000,
        netProfit: 10,
      },
    ]);
    const r = calcHourlyRateForGame(brief, 'Blackjack');
    expect(r.hourlyRate).toBeNull();
    expect(r.totalHours).toBeCloseTo(1 / 60, 10);
  });

  // A session with no end, or an end at or before its start, would make the
  // divisor lie in either direction.
  test('sessions without a sane duration are excluded, not counted as zero', () => {
    const broken = historyFromSessions([
      { ...makeSession({ hands: [hand({ bet: 10, outcome: 'win' })], id: 'a' }), startTime: 0, endTime: null, netProfit: 500 },
      { ...makeSession({ hands: [hand({ bet: 10, outcome: 'win' })], id: 'b' }), startTime: 5 * HOUR, endTime: 5 * HOUR, netProfit: 500 },
      { ...makeSession({ hands: [hand({ bet: 10, outcome: 'win' })], id: 'c' }), startTime: 0, endTime: HOUR, netProfit: 20 },
    ]);
    const r = calcHourlyRateForGame(broken, 'Blackjack');
    expect(r.sample).toBe(1);
    expect(r.totalHours).toBe(1);
    expect(r.hourlyRate).toBe(20);
  });
});
