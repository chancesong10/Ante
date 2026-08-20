import {
  getChronologicalPokerHands,
  calcOutcomeBreakdown,
  calcReturnStats,
  calcBBStats,
  calcFoldStats,
  calcFoldsByStreet,
  calcPostBluffPattern,
  calcInvestmentAfterOutcome,
  calcStreaks,
  calcVolatility,
  calcCommitmentRatio,
  calcShowdownStats,
  calcSessionFoldFatigue,
  buildLeakReport,
  computePokerInsights,
} from '../pokerStatsEngine';

// ---------------------------------------------------------------------
// Same discipline as statsEngine.test.js: every scenario constructs a
// hand sequence where the "correct" answer is known before the engine
// runs, with a focus on the poker-specific signal this game tracks that
// nothing else does — whether a fold turned out to be a bluff or a good
// read.
// ---------------------------------------------------------------------

function pokerHand({
  outcome,
  foldReason,
  streetFolded,
  heroInvestment = 0,
  pot = 0,
  netChange,
  bigBlind = 2,
}) {
  return {
    id: Math.random().toString(36).slice(2),
    gameType: 'Poker',
    outcome,
    foldReason,
    streetFolded,
    heroInvestment,
    pot,
    netChange: netChange !== undefined ? netChange : outcome === 'fold' ? -heroInvestment : 0,
    streets: { preflop: 0, flop: 0, turn: 0, river: 0 },
    timestamp: Date.now(),
    _bigBlind: bigBlind,
  };
}

function makeSession({ hands, startTime, bigBlind = 2, smallBlind = 1, id }) {
  const totalHands = hands.length;
  const netProfit = hands.reduce((s, h) => s + (h.netChange || 0), 0);
  return {
    id: id || Math.random().toString(36).slice(2),
    gameType: 'Poker',
    mode: 'hands',
    startTime: startTime || new Date().toISOString(),
    totalHands,
    netProfit,
    bigBlind,
    smallBlind,
    hands: hands.slice().reverse(), // stored newest-first, as SessionContext does
  };
}

function historyFromSessions(sessions) {
  return sessions.slice().reverse();
}

describe('calcOutcomeBreakdown', () => {
  test('classifies win/split/loss/fold correctly with accurate rates', () => {
    const hands = [
      pokerHand({ outcome: 'win', heroInvestment: 20, pot: 60, netChange: 40 }),
      pokerHand({ outcome: 'split', heroInvestment: 20, pot: 60, netChange: 10 }),
      pokerHand({ outcome: 'loss', heroInvestment: 20, pot: 60, netChange: -20 }),
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 5, pot: 40, netChange: -5 }),
    ];
    const breakdown = calcOutcomeBreakdown(hands);

    expect(breakdown.sample).toBe(4);
    expect(breakdown.wins).toBe(1);
    expect(breakdown.splits).toBe(1);
    expect(breakdown.losses).toBe(1);
    expect(breakdown.folds).toBe(1);
    expect(breakdown.winRate).toBeCloseTo(25, 2);
    expect(breakdown.foldRate).toBeCloseTo(25, 2);
  });

  test('empty hand list returns nulled rates, not NaN', () => {
    const breakdown = calcOutcomeBreakdown([]);
    expect(breakdown.sample).toBe(0);
    expect(breakdown.winRate).toBeNull();
  });
});

describe('calcReturnStats', () => {
  test('sums invested and net profit across wins, losses, and folds', () => {
    const hands = [
      pokerHand({ outcome: 'win', heroInvestment: 20, pot: 60, netChange: 40 }),
      pokerHand({ outcome: 'loss', heroInvestment: 20, pot: 60, netChange: -20 }),
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 5, pot: 40, netChange: -5 }),
    ];
    const ret = calcReturnStats(hands);

    expect(ret.totalInvested).toBe(45);
    expect(ret.netProfit).toBe(15);
    expect(ret.roi).toBeCloseTo((15 / 45) * 100, 2);
  });
});

describe('calcBBStats', () => {
  test('normalizes net profit to big blinds and computes bb/100', () => {
    const hands = [
      pokerHand({ outcome: 'win', heroInvestment: 10, pot: 30, netChange: 20, bigBlind: 2 }), // +10bb
      pokerHand({ outcome: 'loss', heroInvestment: 10, pot: 30, netChange: -10, bigBlind: 2 }), // -5bb
    ];
    const bb = calcBBStats(hands);

    expect(bb.sample).toBe(2);
    expect(bb.netBB).toBeCloseTo(5, 2); // +10bb - 5bb
    expect(bb.bbPer100).toBeCloseTo((5 / 2) * 100, 2);
  });

  test('returns null when no hands have a valid big blind (casual/no-blind sessions)', () => {
    const hands = [pokerHand({ outcome: 'win', heroInvestment: 10, pot: 20, netChange: 10, bigBlind: 0 })];
    expect(calcBBStats(hands)).toBeNull();
  });
});

describe('calcFoldStats — the headline bluff-catching metric', () => {
  test('a deliberately bad bluff-catcher: 7 bluffed / 3 good folds out of 10, with real money left on the table', () => {
    const bluffed = Array.from({ length: 7 }, () =>
      pokerHand({ outcome: 'fold', foldReason: 'bluffed', heroInvestment: 20, pot: 100, streetFolded: 'River (5th)' })
    );
    const good = Array.from({ length: 3 }, () =>
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 10, pot: 40, streetFolded: 'Flop' })
    );
    const hands = [...bluffed, ...good];
    const fold = calcFoldStats(hands);

    expect(fold.sample).toBe(10);
    expect(fold.bluffed).toBe(7);
    expect(fold.goodFold).toBe(3);
    expect(fold.bluffedRate).toBeCloseTo(70, 2);
    // Each bluffed fold left (100 - 20) = 80 on the table, x7 = 560
    expect(fold.moneyLeftOnTable).toBe(560);
  });

  test('a disciplined fold record: mostly good folds, low bluffed rate', () => {
    const bluffed = Array.from({ length: 1 }, () =>
      pokerHand({ outcome: 'fold', foldReason: 'bluffed', heroInvestment: 10, pot: 50 })
    );
    const good = Array.from({ length: 9 }, () =>
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 10, pot: 50 })
    );
    const fold = calcFoldStats([...bluffed, ...good]);

    expect(fold.bluffedRate).toBeCloseTo(10, 2);
  });

  test('no_show folds are excluded from bluffedRate\'s denominator entirely', () => {
    const hands = [
      pokerHand({ outcome: 'fold', foldReason: 'bluffed', heroInvestment: 10, pot: 50 }),
      pokerHand({ outcome: 'fold', foldReason: 'no_show', heroInvestment: 10, pot: 50 }),
      pokerHand({ outcome: 'fold', foldReason: 'no_show', heroInvestment: 10, pot: 50 }),
    ];
    const fold = calcFoldStats(hands);

    expect(fold.judgedSample).toBe(1);
    expect(fold.bluffedRate).toBe(100);
    expect(fold.noShow).toBe(2);
  });
});

describe('calcFoldsByStreet', () => {
  test('isolates the river as the leak when bluffs cluster there', () => {
    const preflopFolds = Array.from({ length: 4 }, () =>
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 2, pot: 6, streetFolded: 'Pre-Flop' })
    );
    const riverFolds = [
      ...Array.from({ length: 4 }, () =>
        pokerHand({ outcome: 'fold', foldReason: 'bluffed', heroInvestment: 50, pot: 200, streetFolded: 'River (5th)' })
      ),
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 50, pot: 200, streetFolded: 'River (5th)' }),
    ];
    const byStreet = calcFoldsByStreet([...preflopFolds, ...riverFolds]);

    const preflop = byStreet.find((s) => s.street === 'Pre-Flop');
    const river = byStreet.find((s) => s.street === 'River (5th)');

    expect(preflop.bluffedRate).toBe(0);
    expect(river.sample).toBe(5);
    expect(river.bluffedRate).toBeCloseTo(80, 2); // 4 of 5 judged folds
    expect(river.moneyLeftOnTable).toBe(4 * (200 - 50));
  });

  test('returns an empty array when there are no folds at all', () => {
    expect(calcFoldsByStreet([pokerHand({ outcome: 'win', heroInvestment: 10, pot: 20, netChange: 10 })])).toEqual([]);
  });
});

describe('calcPostBluffPattern — tilt signature after being bluffed', () => {
  test('detects a real tilt pattern: getting bluffed once makes the next fold judgment worse', () => {
    // Chronological fold-only sequence, engineered so a bluffed fold is
    // almost always immediately followed by ANOTHER bluffed fold, while a
    // good fold is almost always followed by another good fold.
    const pattern = [
      'bluffed', 'bluffed', 'bluffed', 'bluffed', 'bluffed', // after each of the first 4, next is bluffed
      'good_fold', 'good_fold', 'good_fold', 'good_fold', 'good_fold', // after each of these 4, next is good
    ];
    const hands = pattern.map((foldReason) => pokerHand({ outcome: 'fold', foldReason, heroInvestment: 10, pot: 40 }));
    const post = calcPostBluffPattern(hands);

    // 5 "prev = bluffed" transitions (indices 1-5 as "curr"): 4 stay bluffed, 1 (the
    // bluffed->good_fold handoff at the block boundary) doesn't.
    expect(post.afterBluffed.rate).toBeCloseTo(80, 2);
    expect(post.afterBluffed.sample).toBe(5);
    // 4 "prev = good_fold" transitions, all staying good_fold.
    expect(post.afterGood.rate).toBe(0);
    expect(post.afterGood.sample).toBe(4);
    expect(post.tiltIndex).toBeGreaterThan(50);
  });

  test('a fold record with no discernible pattern shows a small tilt index', () => {
    const pattern = ['bluffed', 'good_fold', 'bluffed', 'good_fold', 'bluffed', 'good_fold', 'bluffed', 'good_fold'];
    const hands = pattern.map((foldReason) => pokerHand({ outcome: 'fold', foldReason, heroInvestment: 10, pot: 40 }));
    const post = calcPostBluffPattern(hands);

    // Strict alternation is actually perfectly anti-correlated (mirrors the
    // blackjack audit's finding): after bluffed is ALWAYS good_fold next, and
    // vice versa. That's a real, correctly-detected pattern — just the
    // opposite sign from the "true tilt" test above.
    expect(post.afterBluffed.rate).toBe(0);
    expect(post.afterGood.rate).toBe(100);
  });

  test('no_show folds do not participate as either a preceding or following event', () => {
    const hands = [
      pokerHand({ outcome: 'fold', foldReason: 'bluffed' }),
      pokerHand({ outcome: 'fold', foldReason: 'no_show' }),
      pokerHand({ outcome: 'fold', foldReason: 'good_fold' }),
    ];
    const post = calcPostBluffPattern(hands);
    // no_show is filtered out before the walk, so this is just [bluffed, good_fold] -> 1 transition
    expect(post.afterBluffed.sample).toBe(1);
    expect(post.afterGood.sample).toBe(0);
  });
});

describe('calcInvestmentAfterOutcome — loss-chasing analog', () => {
  test('flags bigger bets after a losing hand than after a winning one', () => {
    const seq = [
      pokerHand({ outcome: 'loss', heroInvestment: 10, pot: 20, netChange: -10 }),
      pokerHand({ outcome: 'loss', heroInvestment: 30, pot: 60, netChange: -30 }), // after a loss
      pokerHand({ outcome: 'win', heroInvestment: 40, pot: 80, netChange: 40 }), // after a loss
      pokerHand({ outcome: 'loss', heroInvestment: 10, pot: 20, netChange: -10 }), // after a win
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 25, pot: 60, netChange: -25 }), // after a loss
    ];
    const inv = calcInvestmentAfterOutcome(seq);

    expect(inv.sampleAfterWin).toBe(1);
    expect(inv.avgInvestmentAfterWin).toBeCloseTo(10, 2);
    expect(inv.sampleAfterLoss).toBe(3);
    expect(inv.avgInvestmentAfterLoss).toBeCloseTo((30 + 40 + 25) / 3, 2);
    expect(inv.avgInvestmentAfterLoss).toBeGreaterThan(inv.avgInvestmentAfterWin);
  });
});

describe('calcStreaks — money-based, folds count as "down"', () => {
  test('a fold breaks an up-streak the same way a showdown loss would', () => {
    const seq = [
      pokerHand({ outcome: 'win', netChange: 20 }),
      pokerHand({ outcome: 'win', netChange: 15 }),
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', netChange: -5 }),
      pokerHand({ outcome: 'loss', netChange: -20 }),
      pokerHand({ outcome: 'win', netChange: 10 }),
    ];
    const streaks = calcStreaks(seq);

    expect(streaks.longestUpStreak).toBe(2);
    expect(streaks.longestDownStreak).toBe(2); // fold + loss back to back
    expect(streaks.currentStreakType).toBe('up');
    expect(streaks.currentStreakLength).toBe(1);
  });
});

describe('calcVolatility', () => {
  test('a spike in investment relative to typical stake reads as High risk', () => {
    const hands = [
      ...Array.from({ length: 8 }, (_, i) =>
        pokerHand({ outcome: i % 2 === 0 ? 'win' : 'loss', heroInvestment: 10, pot: 20, netChange: i % 2 === 0 ? 10 : -10 })
      ),
      pokerHand({ outcome: 'loss', heroInvestment: 400, pot: 800, netChange: -400 }),
    ];
    const vol = calcVolatility(hands);
    expect(vol.riskLabel).toBe('High');
  });

  test('flat investment sizing reads as Low risk', () => {
    const hands = Array.from({ length: 10 }, (_, i) =>
      pokerHand({ outcome: i % 2 === 0 ? 'win' : 'loss', heroInvestment: 20, pot: 40, netChange: i % 2 === 0 ? 20 : -20 })
    );
    const vol = calcVolatility(hands);
    expect(vol.riskLabel).toBe('Low');
  });
});

describe('calcCommitmentRatio', () => {
  test('averages hero investment as a share of the final pot', () => {
    const hands = [
      pokerHand({ outcome: 'win', heroInvestment: 50, pot: 100, netChange: 50 }), // 50%
      pokerHand({ outcome: 'loss', heroInvestment: 20, pot: 100, netChange: -20 }), // 20%
    ];
    const ratio = calcCommitmentRatio(hands);
    expect(ratio.avgCommitmentPct).toBeCloseTo(35, 2);
  });
});

describe('calcShowdownStats', () => {
  test('excludes folds and computes win-or-split rate on showdown hands only', () => {
    const hands = [
      pokerHand({ outcome: 'win', heroInvestment: 10, pot: 30, netChange: 20 }),
      pokerHand({ outcome: 'split', heroInvestment: 10, pot: 30, netChange: 5 }),
      pokerHand({ outcome: 'loss', heroInvestment: 10, pot: 30, netChange: -10 }),
      pokerHand({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 5, pot: 20, netChange: -5 }),
    ];
    const sd = calcShowdownStats(hands);
    expect(sd.sample).toBe(3); // fold excluded
    expect(sd.winOrSplitRate).toBeCloseTo((2 / 3) * 100, 2);
  });
});

describe('calcSessionFoldFatigue', () => {
  test('detects fold judgment eroding in the back half of a session', () => {
    // 20-hand session, split evenly at the midpoint (10/10) so array position
    // lines up exactly with _indexInSession: first half folds are mostly
    // good, second half mostly bluffed.
    const firstHalf = [
      ...Array.from({ length: 6 }, () => ({ outcome: 'win', netChange: 5, heroInvestment: 5, pot: 10 })),
      ...Array.from({ length: 1 }, () => ({ outcome: 'fold', foldReason: 'bluffed', heroInvestment: 5, pot: 20 })),
      ...Array.from({ length: 3 }, () => ({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 5, pot: 20 })),
    ]; // 10 hands, folds: 1 bluffed / 3 good = 25% bluffed
    const secondHalf = [
      ...Array.from({ length: 6 }, () => ({ outcome: 'win', netChange: 5, heroInvestment: 5, pot: 10 })),
      ...Array.from({ length: 3 }, () => ({ outcome: 'fold', foldReason: 'bluffed', heroInvestment: 5, pot: 20 })),
      ...Array.from({ length: 1 }, () => ({ outcome: 'fold', foldReason: 'good_fold', heroInvestment: 5, pot: 20 })),
    ]; // 10 hands, folds: 3 bluffed / 1 good = 75% bluffed

    const allHandsChron = [...firstHalf, ...secondHalf].map((h) => pokerHand(h));
    const session = makeSession({ hands: allHandsChron });
    const sessionHistory = historyFromSessions([session]);
    const flat = getChronologicalPokerHands(sessionHistory);

    const fatigue = calcSessionFoldFatigue(flat);
    expect(fatigue).not.toBeNull();
    expect(fatigue.firstHalf.rate).toBeCloseTo(25, 2);
    expect(fatigue.secondHalf.rate).toBeCloseTo(75, 2);
    expect(fatigue.fatigueDelta).toBeCloseTo(50, 2);
  });

  test('returns null when either half has too few judged folds', () => {
    const hands = [pokerHand({ outcome: 'fold', foldReason: 'bluffed', heroInvestment: 5, pot: 20 })];
    const session = makeSession({ hands });
    const flat = getChronologicalPokerHands(historyFromSessions([session]));
    expect(calcSessionFoldFatigue(flat)).toBeNull();
  });
});

describe('buildLeakReport', () => {
  test('flags bluff_catching when bluffed rate is high with adequate sample', () => {
    const foldStats = { judgedSample: 10, bluffedRate: 60, moneyLeftOnTable: 300, moneyLeftOnTableBB: 150 };
    const leaks = buildLeakReport({
      foldStats,
      foldsByStreet: [],
      postBluffPattern: { afterBluffed: { rate: null, sample: 0 }, afterGood: { rate: null, sample: 0 }, tiltIndex: null },
      investmentAfterOutcome: { sampleAfterWin: 0, sampleAfterLoss: 0, avgInvestmentAfterWin: 0, avgInvestmentAfterLoss: 0 },
      volatility: { riskLabel: 'Low' },
      foldFatigue: null,
    });

    expect(leaks.map((l) => l.id)).toContain('bluff_catching');
    const leak = leaks.find((l) => l.id === 'bluff_catching');
    expect(leak.bluffedRate).toBe(60);
  });

  test('does NOT flag bluff_catching under a small sample, even at a high rate', () => {
    const foldStats = { judgedSample: 2, bluffedRate: 100, moneyLeftOnTable: 50 };
    const leaks = buildLeakReport({
      foldStats,
      foldsByStreet: [],
      postBluffPattern: { afterBluffed: { rate: null, sample: 0 }, afterGood: { rate: null, sample: 0 }, tiltIndex: null },
      investmentAfterOutcome: { sampleAfterWin: 0, sampleAfterLoss: 0, avgInvestmentAfterWin: 0, avgInvestmentAfterLoss: 0 },
      volatility: { riskLabel: 'Low' },
      foldFatigue: null,
    });
    expect(leaks.map((l) => l.id)).not.toContain('bluff_catching');
  });

  test('ranks multiple triggered leaks by descending score', () => {
    const foldStats = { judgedSample: 10, bluffedRate: 90, moneyLeftOnTable: 500 };
    const leaks = buildLeakReport({
      foldStats,
      foldsByStreet: [],
      postBluffPattern: { afterBluffed: { rate: null, sample: 0 }, afterGood: { rate: null, sample: 0 }, tiltIndex: null },
      investmentAfterOutcome: { sampleAfterWin: 0, sampleAfterLoss: 0, avgInvestmentAfterWin: 0, avgInvestmentAfterLoss: 0 },
      volatility: { riskLabel: 'High', volatilityRatio: 3 },
      foldFatigue: null,
    });

    expect(leaks.length).toBe(2);
    expect(leaks[0].score).toBeGreaterThanOrEqual(leaks[1].score);
  });
});

describe('computePokerInsights — end-to-end smoke test', () => {
  test('runs without throwing and stays internally consistent on a realistic mixed session', () => {
    let seed = 11;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const outcomes = ['win', 'loss', 'fold', 'fold', 'split'];
    const foldReasons = ['bluffed', 'good_fold', 'no_show'];
    const hands = Array.from({ length: 40 }, () => {
      const outcome = outcomes[Math.floor(rand() * outcomes.length)];
      const heroInvestment = [5, 10, 20][Math.floor(rand() * 3)];
      const pot = heroInvestment * (2 + Math.floor(rand() * 3));
      const foldReason = outcome === 'fold' ? foldReasons[Math.floor(rand() * foldReasons.length)] : undefined;
      const streetFolded = outcome === 'fold' ? STREET_SAMPLE[Math.floor(rand() * STREET_SAMPLE.length)] : undefined;
      let netChange;
      if (outcome === 'win') netChange = pot - heroInvestment;
      else if (outcome === 'split') netChange = pot / 2 - heroInvestment;
      else if (outcome === 'loss') netChange = -heroInvestment;
      else netChange = -heroInvestment;
      return pokerHand({ outcome, foldReason, streetFolded, heroInvestment, pot, netChange });
    });

    const session = makeSession({ hands, startTime: '2026-03-10T20:00:00Z' });
    const sessionHistory = historyFromSessions([session, session, session]);

    let stats;
    expect(() => {
      stats = computePokerInsights(sessionHistory);
    }).not.toThrow();

    expect(stats.totalHands).toBe(stats.outcomeBreakdown.sample);
    expect(
      stats.outcomeBreakdown.wins +
        stats.outcomeBreakdown.splits +
        stats.outcomeBreakdown.losses +
        stats.outcomeBreakdown.folds
    ).toBe(stats.totalHands);
    expect(Array.isArray(stats.leaks)).toBe(true);
  });
});

const STREET_SAMPLE = ['Pre-Flop', 'Flop', 'Turn (4th)', 'River (5th)'];
