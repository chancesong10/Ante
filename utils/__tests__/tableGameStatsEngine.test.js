import {
  tieOddsOf,
  calcExpectedVsActual,
  calcRouletteBetTypeStats,
  calcWheelMix,
  calcBaccaratSideStats,
  calcTieBetCost,
  calcProgressionStats,
  calcSessionSummary,
  computeTableGameInsights,
} from '../tableGameStatsEngine';
import {
  getRouletteBetType,
  calcRouletteNet,
  calcBaccaratNet,
  rouletteHouseEdge,
  baccaratHouseEdge,
  baccaratWinProbability,
} from '../tableGameOdds';

// ---------------------------------------------------------------------
// Same discipline as the other engine suites: every scenario builds hands
// where the correct answer is known before the engine runs. Hands are built
// in chronological order; makeSession stores them newest-first, the way
// SessionContext does.
// ---------------------------------------------------------------------

let seq = 0;

function spin({ betType = 'redblack', stake = 10, outcome = 'loss', wheel = 'double' } = {}) {
  const t = getRouletteBetType(betType);
  const h = {
    id: `spin${seq++}`,
    type: 'single',
    betType: t.id,
    betLabel: t.label,
    odds: t.odds,
    bet: stake,
    outcome,
    netChange: calcRouletteNet(t.odds, stake, outcome),
    createdAt: Date.now(),
  };
  if (wheel) h.wheel = wheel;
  return h;
}

function hand({ betOn = 'Banker', stake = 100, outcome = 'loss', tieOdds } = {}) {
  const h = {
    id: `hand${seq++}`,
    type: 'single',
    betOn,
    bet: stake,
    outcome,
    netChange: calcBaccaratNet(betOn, stake, outcome, tieOdds ?? 8),
    createdAt: Date.now(),
  };
  if (tieOdds) h.tieOdds = tieOdds;
  return h;
}

function makeSession(gameType, hands, startTime = Date.now()) {
  return {
    id: `session${seq++}`,
    gameType,
    mode: 'hands',
    startTime,
    totalHands: hands.length,
    netProfit: hands.reduce((s, h) => s + h.netChange, 0),
    hands: hands.slice().reverse(),
  };
}

const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

describe('calcExpectedVsActual', () => {
  test('roulette: expected result is total wagered × the wheel edge, luck is the gap', () => {
    const hands = repeat(100, (i) => spin({ stake: 10, outcome: i < 48 ? 'win' : 'loss', wheel: 'double' }));
    const r = calcExpectedVsActual(hands, 'Roulette');
    expect(r.totalWagered).toBe(1000);
    expect(r.actualNet).toBe(-40); // 48 × +10, 52 × -10
    expect(r.expectedNetMax).toBeCloseTo(-52.6316, 3);
    expect(r.expectedNetMin).toBeCloseTo(r.expectedNetMax, 10);
    expect(r.luckMax).toBeCloseTo(12.6316, 3);
    expect(r.houseEdgeMax).toBeCloseTo(5.2632, 3);
    expect(r.isRange).toBe(false);
  });

  test('roulette spins logged before the wheel was recorded come back as a range', () => {
    const hands = repeat(10, () => spin({ stake: 100, outcome: 'loss', wheel: null }));
    const r = calcExpectedVsActual(hands, 'Roulette');
    expect(r.isRange).toBe(true);
    expect(r.unknownWheelSample).toBe(10);
    expect(r.expectedNetMin).toBeCloseTo(-52.6316, 3); // if every spin was double-zero
    expect(r.expectedNetMax).toBeCloseTo(-27.027, 3); // if every spin was single-zero
    expect(r.luckMin).toBeCloseTo(-972.973, 3);
    expect(r.luckMax).toBeCloseTo(-947.368, 3);
  });

  test('baccarat: pushes still carry the edge, and a 9:1 Tie is priced at its own edge', () => {
    const pushes = repeat(10, () => hand({ betOn: 'Banker', stake: 100, outcome: 'push' }));
    const r = calcExpectedVsActual(pushes, 'Baccarat');
    expect(r.actualNet).toBe(0);
    expect(r.expectedNetMax).toBeCloseTo(-10.58, 2);
    expect(r.luckMax).toBeCloseTo(10.58, 2);

    const tie9 = calcExpectedVsActual([hand({ betOn: 'Tie', stake: 100, outcome: 'loss', tieOdds: 9 })], 'Baccarat');
    expect(tie9.expectedNetMax).toBeCloseTo(-100 * baccaratHouseEdge('Tie', 9), 10);
  });

  test('returns null when nothing can be priced', () => {
    expect(calcExpectedVsActual([], 'Roulette')).toBeNull();
    expect(calcExpectedVsActual([spin({ stake: 0 })], 'Roulette')).toBeNull();
    expect(calcExpectedVsActual([hand()], 'Blackjack')).toBeNull();
  });
});

describe('tieOddsOf', () => {
  test('hands from before the payout was recorded were settled at 8:1', () => {
    expect(tieOddsOf({ betOn: 'Tie' })).toBe(8);
    expect(tieOddsOf({ betOn: 'Tie', tieOdds: 9 })).toBe(9);
    expect(tieOddsOf({ betOn: 'Tie', tieOdds: 'nine' })).toBe(8);
  });
});

describe('calcRouletteBetTypeStats', () => {
  test('each bet type is measured against its own true odds and share of action', () => {
    const hands = [
      ...repeat(37, (i) => spin({ betType: 'straight', stake: 1, outcome: i === 0 ? 'win' : 'loss', wheel: 'single' })),
      ...repeat(63, (i) => spin({ betType: 'redblack', stake: 1, outcome: i < 30 ? 'win' : 'loss', wheel: 'double' })),
    ];
    const [straight, red] = calcRouletteBetTypeStats(hands);

    expect(straight.id).toBe('straight');
    expect(straight.hitRate).toBeCloseTo(100 / 37, 6);
    expect(straight.expectedHitRate).toBeCloseTo(100 / 37, 6);
    expect(straight.shareOfWagered).toBeCloseTo(37, 6);
    expect(straight.net).toBe(-1);

    expect(red.id).toBe('redblack');
    expect(red.hitRate).toBeCloseTo((30 / 63) * 100, 6);
    expect(red.expectedHitRate).toBeCloseTo((18 / 38) * 100, 6);
    expect(red.shareOfWagered).toBeCloseTo(63, 6);
  });

  test('with no wheel recorded, the expected hit rate is the midpoint of both wheels', () => {
    const [red] = calcRouletteBetTypeStats([spin({ wheel: null })]);
    expect(red.expectedHitRate).toBeCloseTo(((18 / 37 + 18 / 38) / 2) * 100, 6);
  });
});

describe('calcWheelMix', () => {
  test('buckets spins by wheel and prices the double-zero share', () => {
    const hands = [
      ...repeat(10, () => spin({ stake: 100, wheel: 'double' })),
      ...repeat(5, () => spin({ stake: 100, wheel: 'single' })),
      ...repeat(2, () => spin({ stake: 100, wheel: null })),
    ];
    const mix = calcWheelMix(hands);
    expect(mix.double).toEqual({ sample: 10, wagered: 1000 });
    expect(mix.single).toEqual({ sample: 5, wagered: 500 });
    expect(mix.unknown).toEqual({ sample: 2, wagered: 200 });
    expect(mix.extraCostFromDoubleZero).toBeCloseTo(
      1000 * (rouletteHouseEdge('double') - rouletteHouseEdge('single')),
      10
    );
    expect(mix.extraCostFromDoubleZero).toBeCloseTo(25.6, 1);
  });
});

describe('calcBaccaratSideStats', () => {
  test('win rates count decided hands only, against each side’s true odds', () => {
    const hands = [
      hand({ outcome: 'win' }),
      hand({ outcome: 'win' }),
      hand({ outcome: 'win' }),
      hand({ outcome: 'loss' }),
      hand({ outcome: 'loss' }),
      hand({ outcome: 'push' }),
      ...repeat(4, (i) => hand({ betOn: 'Player', outcome: i < 2 ? 'win' : 'loss' })),
      ...repeat(2, () => hand({ betOn: 'Tie', stake: 50, outcome: 'loss' })),
    ];
    const [banker, player, tie] = calcBaccaratSideStats(hands);

    expect(banker.side).toBe('Banker');
    expect(banker.winRate).toBe(60);
    expect(banker.pushes).toBe(1);
    expect(banker.expectedWinRate).toBeCloseTo(baccaratWinProbability('Banker') * 100, 10);
    expect(banker.shareOfWagered).toBeCloseTo((600 / 1100) * 100, 6);
    expect(banker.houseEdge).toBeCloseTo(1.058, 3);

    expect(player.winRate).toBe(50);
    expect(tie.winRate).toBe(0);
    expect(tie.houseEdge).toBeCloseTo(14.36, 2);
  });
});

describe('calcTieBetCost', () => {
  test('prices Tie bets and the avoidable part of that cost vs. Banker', () => {
    const hands = [
      ...repeat(10, () => hand({ outcome: 'push' })),
      ...repeat(3, () => hand({ betOn: 'Tie', stake: 20, outcome: 'loss' })),
    ];
    const cost = calcTieBetCost(hands);
    expect(cost.sample).toBe(3);
    expect(cost.tieWagered).toBe(60);
    expect(cost.shareOfWagered).toBeCloseTo((60 / 1060) * 100, 6);
    expect(cost.expectedCost).toBeCloseTo(60 * baccaratHouseEdge('Tie', 8), 10);
    expect(cost.extraCostVsBanker).toBeCloseTo(60 * (baccaratHouseEdge('Tie', 8) - baccaratHouseEdge('Banker')), 10);
  });

  test('returns null with no Tie bets', () => {
    expect(calcTieBetCost([hand(), hand({ betOn: 'Player' })])).toBeNull();
  });
});

describe('calcProgressionStats', () => {
  const martingaleRun = () => [
    spin({ stake: 10, outcome: 'loss' }),
    spin({ stake: 20, outcome: 'loss' }),
    spin({ stake: 40, outcome: 'loss' }),
    spin({ stake: 80, outcome: 'win' }),
    spin({ stake: 10, outcome: 'loss' }),
    spin({ stake: 10, outcome: 'win' }),
    spin({ stake: 10, outcome: 'loss' }),
    spin({ stake: 20, outcome: 'win' }),
    spin({ stake: 10, outcome: 'loss' }),
    spin({ stake: 20, outcome: 'loss' }),
    spin({ stake: 40, outcome: 'win' }),
    spin({ stake: 10, outcome: 'loss' }),
    spin({ stake: 20, outcome: 'win' }),
  ];

  test('counts doublings after even-money losses and the longest run of them', () => {
    const r = calcProgressionStats([makeSession('Roulette', martingaleRun())], 'Roulette');
    expect(r.opportunities).toBe(8);
    expect(r.doubledAfterLoss).toBe(7);
    expect(r.rate).toBe(87.5);
    expect(r.longestChain).toBe(3);
  });

  test('inside bets are not progressions', () => {
    const hands = [
      spin({ betType: 'straight', stake: 10, outcome: 'loss' }),
      spin({ betType: 'straight', stake: 20, outcome: 'loss' }),
    ];
    expect(calcProgressionStats([makeSession('Roulette', hands)], 'Roulette')).toBeNull();
  });

  test('never chains across two sessions', () => {
    const history = [
      makeSession('Roulette', [spin({ stake: 10, outcome: 'loss' })]),
      makeSession('Roulette', [spin({ stake: 20, outcome: 'loss' })]),
    ];
    expect(calcProgressionStats(history, 'Roulette')).toBeNull();
  });

  test('baccarat: Player and Banker count, Tie does not', () => {
    const ties = [hand({ betOn: 'Tie', stake: 10 }), hand({ betOn: 'Tie', stake: 20 })];
    expect(calcProgressionStats([makeSession('Baccarat', ties)], 'Baccarat')).toBeNull();

    const sides = [hand({ betOn: 'Player', stake: 10 }), hand({ betOn: 'Banker', stake: 20, outcome: 'win' })];
    const r = calcProgressionStats([makeSession('Baccarat', sides)], 'Baccarat');
    expect(r.opportunities).toBe(1);
    expect(r.doubledAfterLoss).toBe(1);
  });
});

describe('leak report (via computeTableGameInsights)', () => {
  const idsFor = (history, gameType) => computeTableGameInsights(history, gameType).leaks.map((l) => l.id);
  const alternating = (wheel) =>
    repeat(12, (i) => spin({ stake: 10, outcome: i % 2 ? 'win' : 'loss', wheel }));

  test('flags playing mostly double-zero wheels, with what it cost', () => {
    const insights = computeTableGameInsights([makeSession('Roulette', alternating('double'))], 'Roulette');
    expect(insights.leaks.map((l) => l.id)).toEqual(['double_zero_wheel']);
    expect(insights.topLeak.extraCost).toBeCloseTo(120 * (2 / 38 - 1 / 37), 10);
  });

  test('no wheel leak on a single-zero wheel', () => {
    expect(idsFor([makeSession('Roulette', alternating('single'))], 'Roulette')).toEqual([]);
  });

  test('flags Tie bets once they are a real share of the action', () => {
    const hands = [
      ...repeat(10, () => hand({ outcome: 'push' })),
      ...repeat(3, () => hand({ betOn: 'Tie', stake: 20, outcome: 'loss' })),
    ];
    const insights = computeTableGameInsights([makeSession('Baccarat', hands)], 'Baccarat');
    expect(insights.leaks.map((l) => l.id)).toEqual(['tie_bets']);
    expect(insights.topLeak.houseEdge).toBeCloseTo(14.36, 2);
  });

  test('flags Martingale, and does not double-report it as loss chasing', () => {
    const hands = [
      spin({ stake: 10, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 20, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 40, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 80, outcome: 'win', wheel: 'single' }),
      spin({ stake: 10, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 10, outcome: 'win', wheel: 'single' }),
      spin({ stake: 10, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 20, outcome: 'win', wheel: 'single' }),
      spin({ stake: 10, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 20, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 40, outcome: 'win', wheel: 'single' }),
      spin({ stake: 10, outcome: 'loss', wheel: 'single' }),
      spin({ stake: 20, outcome: 'win', wheel: 'single' }),
    ];
    expect(idsFor([makeSession('Roulette', hands)], 'Roulette')).toEqual(['martingale']);
  });

  test('flags plain loss chasing when bets grow after losses without doubling', () => {
    const hands = repeat(12, (i) =>
      spin({ stake: i % 2 ? 13 : 10, outcome: i % 2 ? 'win' : 'loss', wheel: 'single' })
    );
    expect(idsFor([makeSession('Roulette', hands)], 'Roulette')).toEqual(['loss_chasing']);
  });
});

describe('computeTableGameInsights', () => {
  test('only reads sessions for the game it was asked about', () => {
    const history = [
      makeSession('Roulette', repeat(6, () => spin())),
      makeSession('Baccarat', repeat(4, () => hand())),
      makeSession('Blackjack', [{ id: 'bj', type: 'single', bet: 10, outcome: 'win', netChange: 10 }]),
    ];
    const roulette = computeTableGameInsights(history, 'Roulette');
    const baccarat = computeTableGameInsights(history, 'Baccarat');

    expect(roulette.totalHands).toBe(6);
    expect(roulette.betTypeStats).toHaveLength(1);
    expect(roulette.sideStats).toEqual([]);
    expect(roulette.tieBetCost).toBeNull();

    expect(baccarat.totalHands).toBe(4);
    expect(baccarat.betTypeStats).toEqual([]);
    expect(baccarat.wheelMix).toBeNull();
    expect(baccarat.sideStats).toHaveLength(1);
  });
});

describe('calcSessionSummary', () => {
  test('totals, best result, expected result, and a mix sorted by money wagered', () => {
    const summary = calcSessionSummary(
      [
        spin({ stake: 10, outcome: 'win' }),
        spin({ betType: 'straight', stake: 5, outcome: 'win' }),
        spin({ stake: 20, outcome: 'loss' }),
      ],
      'Roulette'
    );
    expect(summary.count).toBe(3);
    expect(summary.totalWagered).toBe(35);
    expect(summary.net).toBe(165);
    expect(summary.avgBet).toBeCloseTo(35 / 3, 10);
    expect(summary.biggestWin).toBe(175);
    expect(summary.expected.expectedNetMax).toBeCloseTo(-35 * (2 / 38), 10);
    expect(summary.mix.map((m) => [m.label, m.count, m.wagered, m.net])).toEqual([
      ['Red / Black', 2, 30, -10],
      ['Straight Up', 1, 5, 175],
    ]);
  });

  test('groups baccarat by side', () => {
    const summary = calcSessionSummary([hand(), hand({ betOn: 'Tie', stake: 5 })], 'Baccarat');
    expect(summary.mix.map((m) => m.label)).toEqual(['Banker', 'Tie']);
  });

  test('an empty session has zeros, no expectation, and no mix', () => {
    const summary = calcSessionSummary([], 'Roulette');
    expect(summary).toMatchObject({ count: 0, totalWagered: 0, avgBet: 0, biggestWin: 0, expected: null, mix: [] });
  });
});
