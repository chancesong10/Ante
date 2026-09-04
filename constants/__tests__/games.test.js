import { DEFAULT_GAME_ORDER, sanitizeGameOrder } from '../games';

describe('sanitizeGameOrder', () => {
  test('returns the default order for nothing stored', () => {
    expect(sanitizeGameOrder(undefined)).toEqual(DEFAULT_GAME_ORDER);
    expect(sanitizeGameOrder(null)).toEqual(DEFAULT_GAME_ORDER);
    expect(sanitizeGameOrder([])).toEqual(DEFAULT_GAME_ORDER);
  });

  test('preserves a valid custom order exactly', () => {
    const custom = ['General', 'Baccarat', 'Roulette', 'Sports Betting', 'Poker', 'Blackjack'];
    expect(sanitizeGameOrder(custom)).toEqual(custom);
  });

  test('drops a key that no longer corresponds to a real game', () => {
    const stored = ['Blackjack', 'Craps', 'Poker', 'Sports Betting', 'Roulette', 'Baccarat', 'General'];
    expect(sanitizeGameOrder(stored)).toEqual([
      'Blackjack',
      'Poker',
      'Sports Betting',
      'Roulette',
      'Baccarat',
      'General',
    ]);
  });

  test('appends a game missing from an older stored order (added since)', () => {
    // Predates Roulette/Baccarat.
    const stored = ['Poker', 'Blackjack', 'Sports Betting', 'General'];
    expect(sanitizeGameOrder(stored)).toEqual(['Poker', 'Blackjack', 'Sports Betting', 'General', 'Roulette', 'Baccarat']);
  });

  test('always returns every known game exactly once', () => {
    const stored = ['Blackjack', 'Blackjack', 'Poker'];
    const result = sanitizeGameOrder(stored);
    expect(result).toHaveLength(DEFAULT_GAME_ORDER.length);
    expect(new Set(result)).toEqual(new Set(DEFAULT_GAME_ORDER));
  });
});
