import {
  ROULETTE_BET_TYPES,
  getRouletteBetType,
  calcRouletteNet,
  calcBaccaratNet,
  BACCARAT_COMMISSION,
  BACCARAT_TIE_ODDS,
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

  test('a Tie win pays the configured tie odds', () => {
    expect(calcBaccaratNet('Tie', 20, 'win')).toBe(20 * BACCARAT_TIE_ODDS);
    expect(BACCARAT_TIE_ODDS).toBe(8);
  });
});
