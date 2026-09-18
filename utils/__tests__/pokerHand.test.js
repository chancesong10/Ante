import {
  heroInvestment,
  opponentsInvestment,
  derivePot,
  currentStreetMaxBet,
  streetMismatch,
  everyoneFolded,
  handNet,
  foldWinNet,
  buildHandRecord,
} from '../pokerHand';

const opp = (id, streetBets, folded = false) => ({ id, folded, streetBets });

describe('investment and pot', () => {
  test('hero investment sums every street', () => {
    expect(heroInvestment({ preflop: 10, flop: 20, turn: 30, river: 40 })).toBe(100);
  });

  test('missing streets and a missing object count as nothing', () => {
    expect(heroInvestment({ preflop: 10 })).toBe(10);
    expect(heroInvestment(undefined)).toBe(0);
    expect(heroInvestment({})).toBe(0);
  });

  // Dead money is the whole reason folding late still costs you.
  test('a folded player’s money stays in the pot', () => {
    const opponents = [
      opp(2, { preflop: 10, flop: 25 }, true),
      opp(3, { preflop: 10, flop: 25 }),
    ];
    expect(opponentsInvestment(opponents)).toBe(70);
    expect(derivePot({ preflop: 10, flop: 25 }, opponents)).toBe(105);
  });

  test('a pot with no opponents is just what the hero put in', () => {
    expect(derivePot({ preflop: 5 }, [])).toBe(5);
    expect(derivePot({ preflop: 5 }, undefined)).toBe(5);
  });
});

describe('currentStreetMaxBet', () => {
  test('is the largest live bet on the street', () => {
    const opponents = [opp(2, { flop: 40 }), opp(3, { flop: 15 })];
    expect(currentStreetMaxBet('flop', 20, opponents)).toBe(40);
  });

  // A folded player's bet is dead money, not a price anyone must match.
  test('ignores folded players even when theirs is the biggest', () => {
    const opponents = [opp(2, { flop: 500 }, true), opp(3, { flop: 15 })];
    expect(currentStreetMaxBet('flop', 20, opponents)).toBe(20);
  });

  test('never goes below zero', () => {
    expect(currentStreetMaxBet('flop', 0, [])).toBe(0);
  });
});

describe('streetMismatch', () => {
  test('null when everyone still in has matched', () => {
    const opponents = [opp(2, { flop: 20 }), opp(3, { flop: 20 })];
    expect(streetMismatch('flop', 20, opponents)).toBeNull();
  });

  test('names who is at what when they have not', () => {
    const opponents = [opp(2, { flop: 20 }), opp(3, { flop: 5 })];
    const rows = streetMismatch('flop', 20, opponents);
    expect(rows).toEqual([
      { label: 'You', amount: 20 },
      { label: 'Player 2', amount: 20 },
      { label: 'Player 3', amount: 5 },
    ]);
  });

  test('a folded player need not have matched', () => {
    const opponents = [opp(2, { flop: 20 }), opp(3, { flop: 5 }, true)];
    expect(streetMismatch('flop', 20, opponents)).toBeNull();
  });

  test('uses the caller’s labels so real names show', () => {
    const rows = streetMismatch('flop', 1, [opp(2, { flop: 2 })], (id) => (id === 2 ? 'Alice' : 'x'));
    expect(rows[1].label).toBe('Alice');
  });

  // The bug this replaced: === on accumulated floats. Two bets that both
  // render "$0.30" blocked the street with a list whose rows looked identical
  // and no way to proceed.
  test('sub-cent float drift does not count as a mismatch', () => {
    const drifted = 0.1 + 0.2; // 0.30000000000000004
    expect(drifted).not.toBe(0.3);
    expect(streetMismatch('flop', 0.3, [opp(2, { flop: drifted })])).toBeNull();
  });

  test('a real one-cent difference still counts', () => {
    expect(streetMismatch('flop', 0.3, [opp(2, { flop: 0.31 })])).not.toBeNull();
  });

  test('null when the hero is alone, with nobody to match', () => {
    expect(streetMismatch('flop', 20, [])).toBeNull();
  });
});

describe('everyoneFolded', () => {
  test('true once every opponent has folded', () => {
    expect(everyoneFolded([opp(2, {}, true), opp(3, {}, true)])).toBe(true);
  });

  test('false while anyone is still in', () => {
    expect(everyoneFolded([opp(2, {}, true), opp(3, {})])).toBe(false);
  });

  // A hand nobody else was in was never contested, so it cannot be won by
  // everyone folding.
  test('false at an empty table', () => {
    expect(everyoneFolded([])).toBe(false);
    expect(everyoneFolded(undefined)).toBe(false);
  });
});

describe('handNet', () => {
  // Net is measured against what you put in, never against the pot.
  test('a win pays the pot minus your own stake', () => {
    expect(handNet({ outcome: 'win', pot: 100, investment: 40 })).toBe(60);
  });

  test('a loss costs exactly what you put in', () => {
    expect(handNet({ outcome: 'loss', pot: 100, investment: 40 })).toBe(-40);
  });

  test('a fold costs exactly what you put in', () => {
    expect(handNet({ outcome: 'fold', pot: 100, investment: 40 })).toBe(-40);
  });

  // The pot splits; your stake does not.
  test('a two-way chop halves the pot and subtracts the full stake', () => {
    expect(handNet({ outcome: 'split', pot: 100, investment: 40, splitCount: 2 })).toBe(10);
  });

  test('a three-way chop can still lose money', () => {
    expect(handNet({ outcome: 'split', pot: 90, investment: 40, splitCount: 3 })).toBe(-10);
  });

  test('a nonsense split count degrades to a whole pot rather than dividing by zero', () => {
    expect(handNet({ outcome: 'split', pot: 100, investment: 40, splitCount: 0 })).toBe(60);
  });

  test('winning a pot you are alone in nets zero', () => {
    expect(handNet({ outcome: 'win', pot: 40, investment: 40 })).toBe(0);
  });
});

describe('foldWinNet', () => {
  test('matches winning at showdown — the money is the same', () => {
    expect(foldWinNet(100, 40)).toBe(60);
    expect(foldWinNet(100, 40)).toBe(handNet({ outcome: 'win', pot: 100, investment: 40 }));
  });
});

describe('buildHandRecord', () => {
  const streetBets = { preflop: 10, flop: 30 };
  const opponents = [opp(2, { preflop: 10, flop: 30 }), opp(3, { preflop: 10 }, true)];

  test('derives pot, investment and net together so they cannot disagree', () => {
    const r = buildHandRecord({
      id: 'abc',
      timestamp: 1234,
      outcome: 'win',
      streetBets,
      opponents,
    });
    expect(r.heroInvestment).toBe(40);
    expect(r.pot).toBe(90); // 40 hero + 40 live opponent + 10 dead money
    expect(r.netChange).toBe(50);
    expect(r.gameType).toBe('Poker');
    expect(r.id).toBe('abc');
    expect(r.timestamp).toBe(1234);
  });

  test('copies street bets rather than aliasing the live object', () => {
    const live = { preflop: 10 };
    const r = buildHandRecord({ id: 'a', timestamp: 1, outcome: 'loss', streetBets: live, opponents: [] });
    live.preflop = 999;
    expect(r.streets.preflop).toBe(10);
  });

  test('splitCount is only carried on a split', () => {
    const win = buildHandRecord({ id: 'a', timestamp: 1, outcome: 'win', streetBets, opponents, splitCount: 3 });
    expect(win.splitCount).toBe(1);
    const split = buildHandRecord({ id: 'b', timestamp: 1, outcome: 'split', streetBets, opponents, splitCount: 3 });
    expect(split.splitCount).toBe(3);
  });

  test('optional fold fields appear only when supplied', () => {
    const plain = buildHandRecord({ id: 'a', timestamp: 1, outcome: 'loss', streetBets, opponents });
    expect(plain).not.toHaveProperty('foldReason');
    expect(plain).not.toHaveProperty('wonBy');

    const folded = buildHandRecord({
      id: 'b',
      timestamp: 1,
      outcome: 'fold',
      streetBets,
      opponents,
      foldReason: 'bluffed',
      streetFolded: 'Flop',
    });
    expect(folded.foldReason).toBe('bluffed');
    expect(folded.streetFolded).toBe('Flop');
  });

  // The engines read these records; sessionFinalize sums netChange across
  // them. A record whose net disagreed with its own pot and investment would
  // corrupt every downstream stat silently.
  test('net always equals what pot and investment imply', () => {
    for (const outcome of ['win', 'loss', 'fold', 'split']) {
      const r = buildHandRecord({ id: 'x', timestamp: 1, outcome, streetBets, opponents, splitCount: 2 });
      expect(r.netChange).toBe(
        handNet({ outcome, pot: r.pot, investment: r.heroInvestment, splitCount: r.splitCount })
      );
    }
  });
});
