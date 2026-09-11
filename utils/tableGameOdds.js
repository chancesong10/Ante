// Pure payout math for Roulette and Baccarat — no React, no UI. Split out of
// the tracker screens (rather than left inline like SportsBettingScreen's
// calcPayout) so it's independently testable: screens import react-native,
// which this repo's node-environment Jest config can't load, so anything
// worth unit-testing has to live somewhere RN-free like this.

// True odds by bet type. `pockets` is how many numbers the bet covers, which
// is what the win probability comes from. Every bet here pays out 36 units
// per pocket covered (pockets × (odds + 1) = 36), which is why they all carry
// the same house edge on a given wheel — the edge comes from the zero
// pockets, not from which bet you pick.
export const ROULETTE_BET_TYPES = [
  { id: 'straight', label: 'Straight Up', odds: 35, pockets: 1 },
  { id: 'split', label: 'Split', odds: 17, pockets: 2 },
  { id: 'street', label: 'Street', odds: 11, pockets: 3 },
  { id: 'corner', label: 'Corner', odds: 8, pockets: 4 },
  { id: 'dozen', label: 'Dozen', odds: 2, pockets: 12 },
  { id: 'column', label: 'Column', odds: 2, pockets: 12 },
  { id: 'redblack', label: 'Red / Black', odds: 1, pockets: 18 },
  { id: 'oddeven', label: 'Odd / Even', odds: 1, pockets: 18 },
  { id: 'highlow', label: '1-18 / 19-36', odds: 1, pockets: 18 },
];

export const getRouletteBetType = (id) =>
  ROULETTE_BET_TYPES.find((t) => t.id === id) || ROULETTE_BET_TYPES[0];

// A loss simply forfeits the bet; a win pays the bet type's odds on top of
// getting the stake back, so netChange (not counting the returned stake) is
// just bet * odds. The wheel doesn't change what a winning bet pays — only
// how often it wins — so there's no wheel parameter here.
export function calcRouletteNet(odds, bet, outcome) {
  if (outcome === 'loss') return -bet;
  if (outcome === 'win') return bet * odds;
  return 0;
}

// Single-zero (European) wheels have 37 pockets; double-zero (American)
// wheels add a 00 for 38. That one extra pocket nearly doubles the edge.
export const ROULETTE_WHEELS = {
  single: { id: 'single', label: 'Single 0', shortLabel: '0', pockets: 37 },
  double: { id: 'double', label: 'Double 00', shortLabel: '00', pockets: 38 },
};

// Double-zero is what most US floors run, and it's the costlier assumption.
export const DEFAULT_ROULETTE_WHEEL = 'double';

export const isRouletteWheel = (wheel) => wheel === 'single' || wheel === 'double';

export function rouletteWinProbability(betTypeId, wheel) {
  const w = ROULETTE_WHEELS[wheel];
  const type = ROULETTE_BET_TYPES.find((t) => t.id === betTypeId);
  if (!w || !type) return null;
  return type.pockets / w.pockets;
}

// House edge as a fraction of the amount bet: 1/37 ≈ 2.70% single-zero,
// 2/38 ≈ 5.26% double-zero. Identical for every bet in ROULETTE_BET_TYPES.
export function rouletteHouseEdge(wheel) {
  const w = ROULETTE_WHEELS[wheel];
  if (!w) return null;
  return (w.pockets - 36) / w.pockets;
}

export const BACCARAT_SIDES = ['Banker', 'Player', 'Tie'];

// Standard commission on a winning Banker bet — nearly universal at real
// tables, unlike the wide house-rule variation on things like side bets.
// Player and Tie pay out clean.
export const BACCARAT_COMMISSION = 0.05;
// Typical Tie payout. Some tables pay 9:1; 8:1 is the more common default,
// and the only payout the tracker offered before it became a setting.
export const BACCARAT_TIE_ODDS = 8;
export const BACCARAT_TIE_ODDS_OPTIONS = [8, 9];

export const isBaccaratTieOdds = (odds) => BACCARAT_TIE_ODDS_OPTIONS.includes(odds);

// Chance of each result on a hand dealt from an eight-deck shoe.
export const BACCARAT_PROBABILITIES = {
  Banker: 0.458597,
  Player: 0.446247,
  Tie: 0.095156,
};

// A push only exists for Player/Banker bets — a Tie result pushes those bets
// (stake back, no win or loss). A Tie *bet* has no push: it either hits or
// it doesn't.
export function calcBaccaratNet(betOn, bet, outcome, tieOdds = BACCARAT_TIE_ODDS) {
  if (outcome === 'push') return 0;
  if (outcome === 'loss') return -bet;
  // win
  if (betOn === 'Banker') return bet * (1 - BACCARAT_COMMISSION);
  if (betOn === 'Tie') return bet * tieOdds;
  return bet;
}

// House edge per hand dealt, as a fraction of the amount bet. Ties count as
// hands for Player/Banker (they push), which is how the published 1.06% /
// 1.24% figures are quoted. Tie: 14.36% at 8:1, 4.84% at 9:1.
export function baccaratHouseEdge(betOn, tieOdds = BACCARAT_TIE_ODDS) {
  const { Banker: banker, Player: player, Tie: tie } = BACCARAT_PROBABILITIES;
  if (betOn === 'Banker') return player - banker * (1 - BACCARAT_COMMISSION);
  if (betOn === 'Player') return banker - player;
  if (betOn === 'Tie') return 1 - tie - tie * tieOdds;
  return null;
}

// How often the bet should win among the hands that actually decide it.
// Player/Banker exclude ties (a push decides nothing); a Tie bet is decided
// by every hand.
export function baccaratWinProbability(betOn) {
  const { Banker: banker, Player: player, Tie: tie } = BACCARAT_PROBABILITIES;
  if (betOn === 'Banker') return banker / (banker + player);
  if (betOn === 'Player') return player / (banker + player);
  if (betOn === 'Tie') return tie;
  return null;
}
