// Pure payout math for Roulette and Baccarat — no React, no UI. Split out of
// the tracker screens (rather than left inline like SportsBettingScreen's
// calcPayout) so it's independently testable: screens import react-native,
// which this repo's node-environment Jest config can't load, so anything
// worth unit-testing has to live somewhere RN-free like this.

// True odds by bet type for a standard wheel — European or American; the
// extra 00 pocket on an American wheel changes the house edge, not what a
// winning bet pays, so there's no wheel-type parameter here.
export const ROULETTE_BET_TYPES = [
  { id: 'straight', label: 'Straight Up', odds: 35 },
  { id: 'split', label: 'Split', odds: 17 },
  { id: 'street', label: 'Street', odds: 11 },
  { id: 'corner', label: 'Corner', odds: 8 },
  { id: 'dozen', label: 'Dozen', odds: 2 },
  { id: 'column', label: 'Column', odds: 2 },
  { id: 'redblack', label: 'Red / Black', odds: 1 },
  { id: 'oddeven', label: 'Odd / Even', odds: 1 },
  { id: 'highlow', label: '1-18 / 19-36', odds: 1 },
];

export const getRouletteBetType = (id) =>
  ROULETTE_BET_TYPES.find((t) => t.id === id) || ROULETTE_BET_TYPES[0];

// A loss simply forfeits the bet; a win pays the bet type's odds on top of
// getting the stake back, so netChange (not counting the returned stake) is
// just bet * odds.
export function calcRouletteNet(odds, bet, outcome) {
  if (outcome === 'loss') return -bet;
  if (outcome === 'win') return bet * odds;
  return 0;
}

// Standard commission on a winning Banker bet — nearly universal at real
// tables, unlike the wide house-rule variation on things like side bets.
// Player and Tie pay out clean.
export const BACCARAT_COMMISSION = 0.05;
// Typical Tie payout. Some tables pay 9:1; 8:1 is the more common default.
export const BACCARAT_TIE_ODDS = 8;

// A push only exists for Player/Banker bets — a Tie result pushes those bets
// (stake back, no win or loss). A Tie *bet* has no push: it either hits or
// it doesn't.
export function calcBaccaratNet(betOn, bet, outcome) {
  if (outcome === 'push') return 0;
  if (outcome === 'loss') return -bet;
  // win
  if (betOn === 'Banker') return bet * (1 - BACCARAT_COMMISSION);
  if (betOn === 'Tie') return bet * BACCARAT_TIE_ODDS;
  return bet;
}
