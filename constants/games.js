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
