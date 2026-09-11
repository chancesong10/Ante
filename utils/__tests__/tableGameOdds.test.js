import {
  ROULETTE_BET_TYPES,
  getRouletteBetType,
  calcRouletteNet,
  rouletteHouseEdge,
  rouletteWinProbability,
  isRouletteWheel,
  calcBaccaratNet,
  baccaratHouseEdge,
  baccaratWinProbability,
  isBaccaratTieOdds,
  BACCARAT_COMMISSION,
  BACCARAT_TIE_ODDS,
  BACCARAT_PROBABILITIES,
} from '../tableGameOdds';

describe('calcRouletteNet', () => {
  test('a loss forfeits the bet regardless of odds', () => {
    expect(calcRouletteNet(35, 10, 'loss')).toBe(-10);
    expect(calcRouletteNet(1, 100, 'loss')).toBe(-100);
  });

  test('a win pays bet * odds, on top of the stake (not counted here)', () => {
    expect(calcRouletteNet(35, 10, 'win')).toBe(350); // straight up
    expect(calcRouletteNet(17, 10, 'win')).toBe(170); // split
    expect(calcRouletteNet(11, 10, 'win')).toBe(110); // street
    expect(calcRouletteNet(8, 10, 'win')).toBe(80); // corner
    expect(calcRouletteNet(2, 10, 'win')).toBe(20); // dozen/column
    expect(calcRouletteNet(1, 10, 'win')).toBe(10); // even money
  });

  test('every bet type in the picker resolves to its correct real-world odds', () => {
    const odds = Object.fromEntries(ROULETTE_BET_TYPES.map((t) => [t.id, t.odds]));
    expect(odds).toEqual({
      straight: 35,
      split: 17,
      street: 11,
      corner: 8,
      dozen: 2,
      column: 2,
      redblack: 1,
      oddeven: 1,
      highlow: 1,
    });
  });

  test('getRouletteBetType falls back to the first type on an unknown id', () => {
    expect(getRouletteBetType('nope')).toBe(ROULETTE_BET_TYPES[0]);
    expect(getRouletteBetType('corner').label).toBe('Corner');
  });
});

describe('roulette house edge', () => {
  test('every bet type pays 36 units per pocket covered', () => {
    ROULETTE_BET_TYPES.forEach((t) => expect(t.pockets * (t.odds + 1)).toBe(36));
  });

  test('single-zero is 2.70%, double-zero is 5.26%', () => {
    expect(rouletteHouseEdge('single') * 100).toBeCloseTo(2.7027, 3);
    expect(rouletteHouseEdge('double') * 100).toBeCloseTo(5.2632, 3);
  });

  test('the edge falls out of win probability × payout for every bet on both wheels', () => {
    ['single', 'double'].forEach((wheel) => {
      ROULETTE_BET_TYPES.forEach((t) => {
        const p = rouletteWinProbability(t.id, wheel);
        const ev = p * t.odds - (1 - p);
        expect(-ev).toBeCloseTo(rouletteHouseEdge(wheel), 10);
      });
    });
  });

  test('an unknown wheel or bet type has no probability or edge', () => {
    expect(rouletteHouseEdge('triple')).toBeNull();
    expect(rouletteWinProbability('nope', 'single')).toBeNull();
    expect(rouletteWinProbability('straight', undefined)).toBeNull();
    expect(isRouletteWheel('single')).toBe(true);
    expect(isRouletteWheel(undefined)).toBe(false);
  });
});

describe('calcBaccaratNet', () => {
  test('a loss forfeits the bet regardless of what was bet on', () => {
    expect(calcBaccaratNet('Player', 100, 'loss')).toBe(-100);
    expect(calcBaccaratNet('Banker', 100, 'loss')).toBe(-100);
    expect(calcBaccaratNet('Tie', 100, 'loss')).toBe(-100);
  });

  test('a push always returns 0, independent of bet size or side', () => {
    expect(calcBaccaratNet('Player', 250, 'push')).toBe(0);
    expect(calcBaccaratNet('Banker', 250, 'push')).toBe(0);
  });

  test('a Player win pays 1:1, clean', () => {
    expect(calcBaccaratNet('Player', 100, 'win')).toBe(100);
  });

  test('a Banker win pays 1:1 minus the standard 5% commission', () => {
    expect(calcBaccaratNet('Banker', 100, 'win')).toBeCloseTo(95, 5);
    expect(BACCARAT_COMMISSION).toBe(0.05);
  });

  test('a Tie win pays 8:1 by default', () => {
    expect(calcBaccaratNet('Tie', 20, 'win')).toBe(20 * BACCARAT_TIE_ODDS);
    expect(BACCARAT_TIE_ODDS).toBe(8);
  });

  test('a Tie win pays 9:1 when the table does', () => {
    expect(calcBaccaratNet('Tie', 20, 'win', 9)).toBe(180);
    // The payout only touches Tie wins.
    expect(calcBaccaratNet('Player', 20, 'win', 9)).toBe(20);
  });
});

describe('baccarat house edge', () => {
  test('the eight-deck result probabilities cover every hand', () => {
    const { Banker, Player, Tie } = BACCARAT_PROBABILITIES;
    expect(Banker + Player + Tie).toBeCloseTo(1, 5);
  });

  test('matches the published edges: Banker 1.06%, Player 1.24%, Tie 14.36% / 4.84%', () => {
    expect(baccaratHouseEdge('Banker') * 100).toBeCloseTo(1.06, 2);
    expect(baccaratHouseEdge('Player') * 100).toBeCloseTo(1.235, 3);
    expect(baccaratHouseEdge('Tie', 8) * 100).toBeCloseTo(14.36, 2);
    expect(baccaratHouseEdge('Tie', 9) * 100).toBeCloseTo(4.84, 2);
    expect(baccaratHouseEdge('Dragon')).toBeNull();
  });

  test('Player and Banker win probabilities exclude ties and sum to 1', () => {
    expect(baccaratWinProbability('Banker') + baccaratWinProbability('Player')).toBeCloseTo(1, 10);
    expect(baccaratWinProbability('Banker') * 100).toBeCloseTo(50.68, 2);
    expect(baccaratWinProbability('Tie')).toBe(BACCARAT_PROBABILITIES.Tie);
  });

  test('only 8:1 and 9:1 are accepted Tie payouts', () => {
    expect(isBaccaratTieOdds(8)).toBe(true);
    expect(isBaccaratTieOdds(9)).toBe(true);
    expect(isBaccaratTieOdds(10)).toBe(false);
    expect(isBaccaratTieOdds(undefined)).toBe(false);
  });
});
