import {
  getChronologicalBets,
  calcOddsEdge,
  calcFavoriteUnderdogStats,
  calcBetTypeStats,
  calcSportStats,
  calcLiveVsPregameStats,
  buildLeakReport,
  computeSportsInsights,
} from '../sportsStatsEngine';

// ---------------------------------------------------------------------
// Same discipline as the blackjack and poker suites: every scenario
// constructs bets where the "correct" answer is known before the engine
// runs. The sports-specific angle here is the odds-implied edge — a
// win rate alone means nothing without the price it was bought at.
// ---------------------------------------------------------------------

function calcPayout(stake, americanOdds) {
  const odds = Number(americanOdds);
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}

function calcNet(stake, odds, outcome) {
  if (outcome === 'win') return calcPayout(stake, odds);
  if (outcome === 'loss') return -stake;
  return 0;
}

function bet({ stake = 50, odds, outcome, betType = 'Moneyline', sport, live, netChange }) {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'single',
    matchup: 'Test Matchup',
    betType,
    bet: stake,
    odds,
    outcome,
    sport,
    live,
    netChange: netChange !== undefined ? netChange : calcNet(stake, odds, outcome),
    timestamp: Date.now(),
  };
}

function makeSession({ hands, startTime, id }) {
  const totalHands = hands.length;
  const netProfit = hands.reduce((s, h) => s + (h.netChange || 0), 0);
  return {
    id: id || Math.random().toString(36).slice(2),
    gameType: 'Sports Betting',
    mode: 'hands',
    startTime: startTime || new Date().toISOString(),
    totalHands,
    netProfit,
    hands: hands.slice().reverse(), // stored newest-first, as SessionContext does
  };
}

function historyFromSessions(sessions) {
  return sessions.slice().reverse();
}

describe('calcOddsEdge — implied probability vs. actual win rate', () => {
  test('a bettor beating their own market price shows a positive edge', () => {
    // -200 implies 66.7% win probability. Winning 9 of 10 (90%) beats that price.
    const hands = [
      ...Array.from({ length: 9 }, () => bet({ stake: 100, odds: -200, outcome: 'win' })),
      bet({ stake: 100, odds: -200, outcome: 'loss' }),
    ];
    const edge = calcOddsEdge(hands);

    expect(edge.sample).toBe(10);
    expect(edge.actualWinRate).toBeCloseTo(90, 2);
    expect(edge.avgImpliedProbability).toBeCloseTo((200 / 300) * 100, 1); // 66.67%
    expect(edge.edge).toBeGreaterThan(20);
  });

  test('a bettor underperforming their own market price shows a negative edge', () => {
    // +150 implies 40% win probability. Winning only 2 of 10 (20%) is well below that.
    const hands = [
      ...Array.from({ length: 2 }, () => bet({ stake: 50, odds: 150, outcome: 'win' })),
      ...Array.from({ length: 8 }, () => bet({ stake: 50, odds: 150, outcome: 'loss' })),
    ];
    const edge = calcOddsEdge(hands);

    expect(edge.actualWinRate).toBeCloseTo(20, 2);
    expect(edge.avgImpliedProbability).toBeCloseTo(40, 2);
    expect(edge.edge).toBeCloseTo(-20, 2);
  });

  test('pushes are excluded from both the sample and the rate', () => {
    const hands = [
      bet({ stake: 50, odds: -110, outcome: 'win' }),
      bet({ stake: 50, odds: -110, outcome: 'push', netChange: 0 }),
      bet({ stake: 50, odds: -110, outcome: 'push', netChange: 0 }),
    ];
    const edge = calcOddsEdge(hands);
    expect(edge.sample).toBe(1);
  });

  test('returns null when there are no decided (win/loss) bets', () => {
    expect(calcOddsEdge([bet({ stake: 50, odds: -110, outcome: 'push', netChange: 0 })])).toBeNull();
  });

  test('bets with 0 / missing odds are excluded rather than folding a bogus 100% into the average', () => {
    const hands = [
      bet({ stake: 50, odds: -200, outcome: 'win' }), // 66.67% implied
      bet({ stake: 50, odds: 0, outcome: 'loss', netChange: -50 }), // unpriceable — ignored
      bet({ stake: 50, odds: undefined, outcome: 'win', netChange: 25 }), // unpriceable — ignored
    ];
    const edge = calcOddsEdge(hands);
    expect(edge.sample).toBe(1);
    expect(edge.avgImpliedProbability).toBeCloseTo((200 / 300) * 100, 1);
    expect(Number.isNaN(edge.edge)).toBe(false);
  });

  test('returns null when every decided bet has unusable odds', () => {
    expect(
      calcOddsEdge([
        bet({ stake: 50, odds: 0, outcome: 'win', netChange: 10 }),
        bet({ stake: 50, odds: NaN, outcome: 'loss', netChange: -50 }),
      ])
    ).toBeNull();
  });
});

describe('calcFavoriteUnderdogStats', () => {
  test('splits favorites (negative odds) from underdogs (positive odds) and computes ROI independently', () => {
    const favorites = [
      ...Array.from({ length: 6 }, () => bet({ stake: 100, odds: -200, outcome: 'win' })), // +50 each
      ...Array.from({ length: 4 }, () => bet({ stake: 100, odds: -200, outcome: 'loss' })), // -100 each
    ]; // net = 300 - 400 = -100, staked 1000 -> roi -10%
    const underdogs = [
      ...Array.from({ length: 2 }, () => bet({ stake: 50, odds: 300, outcome: 'win' })), // +150 each
      ...Array.from({ length: 8 }, () => bet({ stake: 50, odds: 300, outcome: 'loss' })), // -50 each
    ]; // net = 300 - 400 = -100, staked 500 -> roi -20%

    const stats = calcFavoriteUnderdogStats([...favorites, ...underdogs]);

    expect(stats.favorites.sample).toBe(10);
    expect(stats.favorites.winRate).toBeCloseTo(60, 2);
    expect(stats.favorites.roi).toBeCloseTo(-10, 2);

    expect(stats.underdogs.sample).toBe(10);
    expect(stats.underdogs.winRate).toBeCloseTo(20, 2);
    expect(stats.underdogs.roi).toBeCloseTo(-20, 2);
  });

  test('bets with 0 / non-numeric odds land in neither bucket', () => {
    const stats = calcFavoriteUnderdogStats([
      bet({ stake: 50, odds: -150, outcome: 'win' }),
      bet({ stake: 50, odds: 200, outcome: 'loss' }),
      bet({ stake: 50, odds: 0, outcome: 'win', netChange: 10 }),
      bet({ stake: 50, odds: undefined, outcome: 'loss', netChange: -50 }),
    ]);
    expect(stats.favorites.sample).toBe(1);
    expect(stats.underdogs.sample).toBe(1);
  });
});

describe('calcBetTypeStats', () => {
  test('groups by bet type and correctly isolates a losing Parlay bucket', () => {
    const moneyline = Array.from({ length: 5 }, () => bet({ stake: 50, odds: -110, outcome: 'win' })); // +45.45 each
    const parlay = [
      ...Array.from({ length: 1 }, () => bet({ stake: 20, odds: 500, outcome: 'win', betType: 'Parlay' })), // +100
      ...Array.from({ length: 9 }, () => bet({ stake: 20, odds: 500, outcome: 'loss', betType: 'Parlay' })), // -20 each
    ]; // net = 100 - 180 = -80, staked 200 -> roi -40%

    const stats = calcBetTypeStats([...moneyline, ...parlay]);
    const ml = stats.find((s) => s.type === 'Moneyline');
    const pl = stats.find((s) => s.type === 'Parlay');

    expect(ml.sample).toBe(5);
    expect(ml.roi).toBeGreaterThan(0);
    expect(pl.sample).toBe(10);
    expect(pl.roi).toBeCloseTo(-40, 2);
  });
});

describe('calcSportStats', () => {
  test('identifies the best and worst sport by ROI, excluding bets with no sport tagged', () => {
    const nba = Array.from({ length: 4 }, () => bet({ stake: 50, odds: -110, sport: 'NBA', outcome: 'win' }));
    const nfl = Array.from({ length: 4 }, () => bet({ stake: 50, odds: -110, sport: 'NFL', outcome: 'loss' }));
    const untagged = Array.from({ length: 3 }, () => bet({ stake: 50, odds: -110, outcome: 'win' })); // no sport field

    const stats = calcSportStats([...nba, ...nfl, ...untagged]);

    expect(stats.all.length).toBe(2); // untagged bets excluded entirely
    expect(stats.best.sport).toBe('NBA');
    expect(stats.worst.sport).toBe('NFL');
  });

  test('returns null when no bets have a sport tagged', () => {
    expect(calcSportStats([bet({ stake: 50, odds: -110, outcome: 'win' })])).toBeNull();
  });
});

describe('calcLiveVsPregameStats', () => {
  test('flags live betting as worse than pregame when the data shows it', () => {
    const live = [
      ...Array.from({ length: 1 }, () => bet({ stake: 50, odds: -110, outcome: 'win', live: true })),
      ...Array.from({ length: 9 }, () => bet({ stake: 50, odds: -110, outcome: 'loss', live: true })),
    ];
    const pregame = Array.from({ length: 10 }, () => bet({ stake: 50, odds: -110, outcome: 'win', live: false }));

    const stats = calcLiveVsPregameStats([...live, ...pregame]);
    expect(stats.live.roi).toBeLessThan(stats.pregame.roi);
  });

  test('returns null when the player has never logged a live bet', () => {
    expect(calcLiveVsPregameStats([bet({ stake: 50, odds: -110, outcome: 'win', live: false })])).toBeNull();
  });
});

describe('buildLeakReport', () => {
  const emptyBetSizeAfterOutcome = { sampleAfterWin: 0, sampleAfterLoss: 0, avgBetAfterWin: 0, avgBetAfterLoss: 0 };

  test('flags negative_edge with adequate sample and a large enough gap', () => {
    const leaks = buildLeakReport({
      oddsEdge: { sample: 10, actualWinRate: 20, avgImpliedProbability: 45, edge: -25 },
      favoriteUnderdog: { favorites: { sample: 0, roi: null }, underdogs: { sample: 0, roi: null } },
      betTypeStats: [],
      liveVsPregame: null,
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      volatility: { riskLabel: 'Low' },
      returnStats: { roi: -10 },
    });
    expect(leaks.map((l) => l.id)).toContain('negative_edge');
  });

  test('flags parlay_leak when parlays clearly underperform the overall ROI', () => {
    const leaks = buildLeakReport({
      oddsEdge: null,
      favoriteUnderdog: { favorites: { sample: 0, roi: null }, underdogs: { sample: 0, roi: null } },
      betTypeStats: [{ type: 'Parlay', sample: 6, roi: -45, winRate: 15, netProfit: -100 }],
      liveVsPregame: null,
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      volatility: { riskLabel: 'Low' },
      returnStats: { roi: -5 },
    });
    expect(leaks.map((l) => l.id)).toContain('parlay_leak');
  });

  test('does not flag parlay_leak when the sample is too small', () => {
    const leaks = buildLeakReport({
      oddsEdge: null,
      favoriteUnderdog: { favorites: { sample: 0, roi: null }, underdogs: { sample: 0, roi: null } },
      betTypeStats: [{ type: 'Parlay', sample: 2, roi: -80, winRate: 0, netProfit: -50 }],
      liveVsPregame: null,
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      volatility: { riskLabel: 'Low' },
      returnStats: { roi: -5 },
    });
    expect(leaks.map((l) => l.id)).not.toContain('parlay_leak');
  });

  test('ranks multiple triggered leaks by descending score', () => {
    const leaks = buildLeakReport({
      oddsEdge: { sample: 10, actualWinRate: 10, avgImpliedProbability: 45, edge: -35 },
      favoriteUnderdog: { favorites: { sample: 0, roi: null }, underdogs: { sample: 0, roi: null } },
      betTypeStats: [],
      liveVsPregame: null,
      betSizeAfterOutcome: emptyBetSizeAfterOutcome,
      volatility: { riskLabel: 'High', volatilityRatio: 3 },
      returnStats: { roi: -10 },
    });
    expect(leaks.length).toBe(2);
    expect(leaks[0].score).toBeGreaterThanOrEqual(leaks[1].score);
  });
});

describe('computeSportsInsights — end-to-end smoke test', () => {
  test('runs without throwing and stays internally consistent on a realistic mixed session', () => {
    let seed = 5;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const outcomes = ['win', 'loss', 'loss', 'push'];
    const types = ['Moneyline', 'Spread', 'Total', 'Parlay'];
    const sports = ['NBA', 'NFL', 'MLB'];
    const oddsPool = [-200, -150, -110, 100, 150, 250];

    const hands = Array.from({ length: 40 }, () => {
      const stake = [10, 25, 50][Math.floor(rand() * 3)];
      const odds = oddsPool[Math.floor(rand() * oddsPool.length)];
      const outcome = outcomes[Math.floor(rand() * outcomes.length)];
      const betType = types[Math.floor(rand() * types.length)];
      const sport = sports[Math.floor(rand() * sports.length)];
      const live = rand() < 0.2;
      return bet({ stake, odds, outcome, betType, sport, live });
    });

    const session = makeSession({ hands, startTime: '2026-04-01T19:00:00Z' });
    const sessionHistory = historyFromSessions([session, session, session]);

    let stats;
    expect(() => {
      stats = computeSportsInsights(sessionHistory);
    }).not.toThrow();

    expect(stats.totalHands).toBe(stats.outcomeBreakdown.sample);
    expect(
      stats.outcomeBreakdown.wins + stats.outcomeBreakdown.losses + stats.outcomeBreakdown.pushes
    ).toBe(stats.totalHands);
    expect(Array.isArray(stats.leaks)).toBe(true);
  });
});
