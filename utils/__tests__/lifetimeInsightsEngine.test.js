import {
  getAllSessionsChronological,
  calcGameBreakdown,
  calcSessionStreaks,
  calcDayOfWeekPerformance,
  calcSessionLengthPerformance,
  calcVolatility,
  calcTimePlayed,
  buildLeakReport,
  computeLifetimeInsights,
} from '../lifetimeInsightsEngine';

// ---------------------------------------------------------------------
// Same discipline as the per-game suites: every scenario constructs
// sessions where the "correct" answer is known before the engine runs.
// The angle here is specifically cross-game: sessions of different
// gameTypes and modes ('hands' vs 'buyInCashOut') mixed together.
// ---------------------------------------------------------------------

function handsSession({ gameType, netProfit, wins = 0, losses = 0, totalHands, startTime, id }) {
  return {
    id: id || Math.random().toString(36).slice(2),
    gameType,
    mode: 'hands',
    startTime: startTime || new Date().toISOString(),
    totalHands: totalHands !== undefined ? totalHands : wins + losses,
    netProfit,
    wins,
    losses,
  };
}

function buyInSession({ gameType = 'General', netProfit, startTime, id }) {
  return {
    id: id || Math.random().toString(36).slice(2),
    gameType,
    mode: 'buyInCashOut',
    startTime: startTime || new Date().toISOString(),
    totalHands: 0,
    netProfit,
    wins: netProfit > 0 ? 1 : 0,
    losses: netProfit < 0 ? 1 : 0,
  };
}

// sessionHistory is stored newest-first.
function historyFromSessions(sessions) {
  return sessions.slice().reverse();
}

describe('getAllSessionsChronological', () => {
  test('reverses newest-first storage into oldest-first order', () => {
    const sessions = [
      handsSession({ gameType: 'Blackjack', netProfit: 10 }),
      handsSession({ gameType: 'Poker', netProfit: -5 }),
    ];
    const history = historyFromSessions(sessions);
    const chron = getAllSessionsChronological(history);
    expect(chron.map((s) => s.gameType)).toEqual(['Blackjack', 'Poker']);
  });
});

describe('calcGameBreakdown', () => {
  test('aggregates net profit and win rate per game, mixing hands-mode and buyIn-mode sessions', () => {
    const sessions = [
      ...Array.from({ length: 4 }, () => handsSession({ gameType: 'Blackjack', netProfit: 50, wins: 6, losses: 4 })),
      ...Array.from({ length: 4 }, () => handsSession({ gameType: 'Poker', netProfit: -30, wins: 2, losses: 8 })),
      ...Array.from({ length: 3 }, () => buyInSession({ gameType: 'General', netProfit: 20 })),
    ];
    const breakdown = calcGameBreakdown(sessions);

    const bj = breakdown.all.find((g) => g.gameType === 'Blackjack');
    const pk = breakdown.all.find((g) => g.gameType === 'Poker');
    const gen = breakdown.all.find((g) => g.gameType === 'General');

    expect(bj.sessions).toBe(4);
    expect(bj.netProfit).toBe(200);
    expect(bj.avgNetPerSession).toBeCloseTo(50, 2);
    expect(bj.winRate).toBeCloseTo(60, 2); // 24 wins / (24+16)

    expect(pk.avgNetPerSession).toBeCloseTo(-30, 2);
    expect(gen.sessions).toBe(3);
    expect(gen.avgNetPerSession).toBeCloseTo(20, 2);
  });

  test('identifies best and worst game by average net per session', () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => handsSession({ gameType: 'Blackjack', netProfit: 40 })),
      ...Array.from({ length: 3 }, () => handsSession({ gameType: 'Poker', netProfit: -60 })),
    ];
    const breakdown = calcGameBreakdown(sessions);
    expect(breakdown.best.gameType).toBe('Blackjack');
    expect(breakdown.worst.gameType).toBe('Poker');
  });

  test('an unrecognized gameType falls into the General bucket', () => {
    const sessions = [handsSession({ gameType: 'Roulette', netProfit: 10, wins: 1, losses: 0 })];
    const breakdown = calcGameBreakdown(sessions);
    expect(breakdown.all.find((g) => g.gameType === 'General').sessions).toBe(1);
    expect(breakdown.all.find((g) => g.gameType === 'Roulette')).toBeUndefined();
  });

  test('excludes game buckets with fewer than 3 sessions from best/worst ranking', () => {
    const sessions = [
      handsSession({ gameType: 'Blackjack', netProfit: 1000 }), // huge but only 1 session
      ...Array.from({ length: 3 }, () => handsSession({ gameType: 'Poker', netProfit: 10 })),
    ];
    const breakdown = calcGameBreakdown(sessions);
    expect(breakdown.best.gameType).toBe('Poker');
  });
});

describe('calcSessionStreaks', () => {
  test('measures winning/losing streaks in whole sessions from a known net-profit pattern', () => {
    const nets = [50, 30, -10, -20, -5, 40, 60, 10, -15];
    const sessions = nets.map((netProfit) => handsSession({ gameType: 'Blackjack', netProfit }));
    const streaks = calcSessionStreaks(sessions);

    expect(streaks.longestWinStreak).toBe(3); // the trailing 40,60,10 run
    expect(streaks.longestLossStreak).toBe(3); // -10,-20,-5
    expect(streaks.currentStreakType).toBe('loss');
    expect(streaks.currentStreakLength).toBe(1);
  });
});

describe('calcDayOfWeekPerformance', () => {
  test('finds best/worst day across mixed game types', () => {
    // 2026 calendar reference: Jan 5 = Monday, Jan 9 = Friday
    const sessions = [
      handsSession({ gameType: 'Blackjack', netProfit: 80, startTime: '2026-01-05T18:00:00Z' }),
      buyInSession({ gameType: 'General', netProfit: 60, startTime: '2026-01-12T18:00:00Z' }),
      handsSession({ gameType: 'Poker', netProfit: -70, startTime: '2026-01-09T18:00:00Z' }),
      handsSession({ gameType: 'Sports Betting', netProfit: -50, startTime: '2026-01-16T18:00:00Z' }),
    ];
    const dow = calcDayOfWeekPerformance(sessions);
    expect(dow.best.day).toBe('Monday');
    expect(dow.worst.day).toBe('Friday');
  });

  test('returns null with fewer than 2 distinct days', () => {
    const sessions = [handsSession({ gameType: 'Blackjack', netProfit: 10, startTime: '2026-01-05T18:00:00Z' })];
    expect(calcDayOfWeekPerformance(sessions)).toBeNull();
  });
});

describe('calcSessionLengthPerformance', () => {
  test('splits short/medium/long sessions across game types by totalHands', () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => handsSession({ gameType: 'Blackjack', netProfit: 20, totalHands: 5 })),
      ...Array.from({ length: 3 }, () => handsSession({ gameType: 'Poker', netProfit: -60, totalHands: 30 })),
    ];
    const lenPerf = calcSessionLengthPerformance(sessions);
    expect(lenPerf.short.avgNetPerHand).toBeCloseTo(4, 2); // 20/5
    expect(lenPerf.long.avgNetPerHand).toBeCloseTo(-2, 2); // -60/30
  });

  test('returns null under 3 total sessions', () => {
    const sessions = [handsSession({ gameType: 'Blackjack', netProfit: 10, totalHands: 5 })];
    expect(calcSessionLengthPerformance(sessions)).toBeNull();
  });
});

describe('calcVolatility', () => {
  test('a single huge outlier session among small stable ones reads as High risk', () => {
    const sessions = [
      ...Array.from({ length: 8 }, (_, i) => handsSession({ gameType: 'Blackjack', netProfit: i % 2 === 0 ? 10 : -10 })),
      handsSession({ gameType: 'Poker', netProfit: -400 }),
    ];
    const vol = calcVolatility(sessions);
    expect(vol.riskLabel).toBe('High');
  });

  test('consistent session sizes read as Low risk', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => handsSession({ gameType: 'Blackjack', netProfit: i % 2 === 0 ? 25 : -25 }));
    const vol = calcVolatility(sessions);
    expect(vol.riskLabel).toBe('Low');
  });
});

describe('calcTimePlayed', () => {
  test('sums duration in minutes across sessions with a known start/end pair', () => {
    const sessions = [
      { startTime: 0, endTime: 30 * 60000 }, // 30 min
      { startTime: 0, endTime: 90 * 60000 }, // 90 min
    ];
    const time = calcTimePlayed(sessions);
    expect(time.totalMinutes).toBeCloseTo(120, 2);
    expect(time.avgMinutesPerSession).toBeCloseTo(60, 2);
    expect(time.sample).toBe(2);
  });

  test('excludes sessions missing a valid start/end pair rather than treating them as zero', () => {
    const sessions = [
      { startTime: 0, endTime: 60 * 60000 }, // 60 min, valid
      { startTime: 0, endTime: 0 }, // invalid: endTime not after startTime
      { startTime: 0 }, // invalid: no endTime at all
    ];
    const time = calcTimePlayed(sessions);
    expect(time.sample).toBe(1);
    expect(time.totalMinutes).toBeCloseTo(60, 2);
  });

  test('returns null when no session has a valid duration', () => {
    expect(calcTimePlayed([{ startTime: 0 }])).toBeNull();
  });
});

describe('buildLeakReport', () => {
  const noVolatility = { riskLabel: 'Low' };

  test('flags worst_game when one game is clearly dragging down the average', () => {
    const leaks = buildLeakReport({
      gameBreakdown: {
        best: { gameType: 'Blackjack', avgNetPerSession: 40, sessions: 5 },
        worst: { gameType: 'Poker', avgNetPerSession: -60, sessions: 5 },
      },
      dayOfWeekPerformance: null,
      sessionLengthPerformance: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('worst_game');
  });

  test('does not flag worst_game when the "worst" game is still profitable', () => {
    const leaks = buildLeakReport({
      gameBreakdown: {
        best: { gameType: 'Blackjack', avgNetPerSession: 40, sessions: 5 },
        worst: { gameType: 'Poker', avgNetPerSession: 5, sessions: 5 },
      },
      dayOfWeekPerformance: null,
      sessionLengthPerformance: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).not.toContain('worst_game');
  });

  test('flags day_of_week_drag when one day is a clear, well-sampled outlier', () => {
    const leaks = buildLeakReport({
      gameBreakdown: { best: null, worst: null },
      dayOfWeekPerformance: {
        best: { day: 'Monday', avgNet: 50, sessions: 4 },
        worst: { day: 'Friday', avgNet: -60, sessions: 4 },
        allDays: [],
      },
      sessionLengthPerformance: null,
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('day_of_week_drag');
  });

  test('flags session_length_fatigue when long sessions clearly underperform short ones', () => {
    const leaks = buildLeakReport({
      gameBreakdown: { best: null, worst: null },
      dayOfWeekPerformance: null,
      sessionLengthPerformance: {
        short: { sample: 4, avgNetPerHand: 5 },
        medium: { sample: 4, avgNetPerHand: 0 },
        long: { sample: 4, avgNetPerHand: -6 },
      },
      volatility: noVolatility,
    });
    expect(leaks.map((l) => l.id)).toContain('session_length_fatigue');
  });

  test('flags volatility on a High risk label', () => {
    const leaks = buildLeakReport({
      gameBreakdown: { best: null, worst: null },
      dayOfWeekPerformance: null,
      sessionLengthPerformance: null,
      volatility: { riskLabel: 'High', volatilityRatio: 3 },
    });
    expect(leaks.map((l) => l.id)).toContain('volatility');
  });

  test('ranks multiple triggered leaks by descending score', () => {
    const leaks = buildLeakReport({
      gameBreakdown: {
        best: { gameType: 'Blackjack', avgNetPerSession: 10, sessions: 5 },
        worst: { gameType: 'Poker', avgNetPerSession: -80, sessions: 5 },
      },
      dayOfWeekPerformance: null,
      sessionLengthPerformance: null,
      volatility: { riskLabel: 'High', volatilityRatio: 3 },
    });
    expect(leaks.length).toBe(2);
    expect(leaks[0].score).toBeGreaterThanOrEqual(leaks[1].score);
  });
});

describe('computeLifetimeInsights — end-to-end smoke test', () => {
  test('runs without throwing and stays internally consistent across mixed game types and modes', () => {
    let seed = 3;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const gameTypes = ['Blackjack', 'Poker', 'Sports Betting', 'General'];
    const sessions = Array.from({ length: 30 }, (_, i) => {
      const gameType = gameTypes[Math.floor(rand() * gameTypes.length)];
      const netProfit = Math.round((rand() - 0.5) * 200);
      const wins = Math.floor(rand() * 10);
      const losses = Math.floor(rand() * 10);
      const startTime = new Date(2026, 0, 1 + i).toISOString();
      return gameType === 'General'
        ? buyInSession({ gameType, netProfit, startTime })
        : handsSession({ gameType, netProfit, wins, losses, totalHands: wins + losses, startTime });
    });

    const sessionHistory = historyFromSessions(sessions);

    let stats;
    expect(() => {
      stats = computeLifetimeInsights(sessionHistory);
    }).not.toThrow();

    expect(stats.totalSessions).toBe(30);
    expect(Array.isArray(stats.leaks)).toBe(true);
    const breakdownTotalSessions = stats.gameBreakdown.all.reduce((sum, g) => sum + g.sessions, 0);
    expect(breakdownTotalSessions).toBe(30);
  });
});
