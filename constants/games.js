// Canonical list of every game the Start Session sheet offers, in the
// default/fallback display order. The sheet (StartSessionModal) and the
// Settings screen that lets a user customize that order (ProfileScreen) both
// read off this instead of keeping their own separate ordering list, so
// adding a seventh game only means updating this one place — plus
// StartSessionModal's own GAME_CARDS, which is display copy (title,
// description, icon) rather than ordering and belongs there.
export const DEFAULT_GAME_ORDER = [
  'Blackjack',
  'Poker',
  'Sports Betting',
  'Roulette',
  'Baccarat',
  'General',
];

// The stack screen each game's tracker is registered under in App.js.
//
// Three places used to know this mapping — App.js (as six separate
// onNavigateToX props), the Start Session sheet (as a ternary chain plus a
// `nav` field on every game card), and Home (as its own ternary chain) — and
// only the names differ from the game keys at all, for Sports Betting and
// General. One map means adding a seventh tracker is a line here rather than
// a prop threaded through the sheet.
export const GAME_ROUTES = {
  Blackjack: 'Blackjack',
  Poker: 'Poker',
  'Sports Betting': 'SportsBetting',
  Roulette: 'Roulette',
  Baccarat: 'Baccarat',
  General: 'GeneralTracker',
};

// Falls back to Blackjack for an unrecognised game, which is what the
// ternary chains this replaces did — a session whose gameType predates a
// rename still lands somewhere real rather than crashing the navigator.
export function routeForGame(gameType) {
  return GAME_ROUTES[gameType] || GAME_ROUTES.Blackjack;
}

// The two games whose stop button has to open the tracker rather than end the
// session where it stands: General has no net until a cash-out is typed, and
// Sports Betting has its own pending-bet confirmation to run first. Home and
// the Start Session sheet both offer that button, and both had the carve-out
// spelled out inline.
export function needsTrackerToEnd(gameType) {
  return gameType === 'General' || gameType === 'Sports Betting';
}

// Reconciles a stored order against the current game list: drops any key
// that no longer corresponds to a real game (one was removed since the
// preference was saved) or repeats one already kept, then appends any
// current game missing from the stored list (one was added since) in the
// default order's relative position. Always returns every known game
// exactly once.
export function sanitizeGameOrder(stored) {
  if (!Array.isArray(stored) || stored.length === 0) return [...DEFAULT_GAME_ORDER];
  const known = new Set(DEFAULT_GAME_ORDER);
  const seen = new Set();
  const kept = [];
  stored.forEach((key) => {
    if (known.has(key) && !seen.has(key)) {
      seen.add(key);
      kept.push(key);
    }
  });
  const missing = DEFAULT_GAME_ORDER.filter((key) => !seen.has(key));
  return [...kept, ...missing];
}
