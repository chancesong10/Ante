import {
  DEFAULT_GAME_ORDER,
  sanitizeGameOrder,
  GAME_ROUTES,
  routeForGame,
  needsTrackerToEnd,
} from '../games';

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

// App.js registers one stack screen per tracker and resolves these names
// against it. A game missing from the map, or pointing at a name App.js does
// not register, is a dead tap on the Start Session sheet.
describe('routeForGame', () => {
  test('covers every game in the default order', () => {
    DEFAULT_GAME_ORDER.forEach((game) => {
      expect(typeof GAME_ROUTES[game]).toBe('string');
      expect(routeForGame(game)).toBe(GAME_ROUTES[game]);
    });
  });

  // The two that differ from their game key, and so are the two worth pinning.
  test('maps the games whose screen name is not their key', () => {
    expect(routeForGame('Sports Betting')).toBe('SportsBetting');
    expect(routeForGame('General')).toBe('GeneralTracker');
  });

  // What the ternary chains this replaced did: an unknown gameType — a record
  // from a build before a rename — lands somewhere real rather than handing
  // the navigator an undefined screen.
  test('falls back to Blackjack for a game it does not know', () => {
    expect(routeForGame('Craps')).toBe('Blackjack');
    expect(routeForGame(undefined)).toBe('Blackjack');
  });
});

describe('needsTrackerToEnd', () => {
  // General has no net until a cash-out is typed and Sports Betting has its
  // own pending-bet confirmation, so neither can be stopped from a list.
  test('is true only for the two games that cannot end from a list', () => {
    expect(needsTrackerToEnd('General')).toBe(true);
    expect(needsTrackerToEnd('Sports Betting')).toBe(true);
    ['Blackjack', 'Poker', 'Roulette', 'Baccarat'].forEach((game) => {
      expect(needsTrackerToEnd(game)).toBe(false);
    });
  });
});
