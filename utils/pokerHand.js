// Pure poker hand math — no React, no UI.
//
// Extracted from PokerScreen, where it sat inside a 1,600-line component with
// no test covering it. That mattered more here than anywhere else in the app:
// the analytics engines are correct functions over hand records, so if the
// records are built wrong every downstream stat is wrong too, and the suite
// could not tell.
//
// The shapes this works with, as PokerScreen holds them:
//   streetBets  { preflop, flop, turn, river }  — the hero's own bets
//   opponent    { id, folded, streetBets: { preflop, flop, turn, river } }

export const STREET_KEYS = ['preflop', 'flop', 'turn', 'river'];

// Half a cent — below this two money figures are the same amount as far as
// the player is concerned, since every amount is rendered to two decimals.
// Bets are accumulated floats (a chip path of 0.10 + 0.20 lands on
// 0.30000000000000004), so every comparison here has to allow for drift.
export const MONEY_EPSILON = 0.005;

function sumStreets(streetBets) {
  if (!streetBets) return 0;
  return STREET_KEYS.reduce((sum, key) => sum + (Number(streetBets[key]) || 0), 0);
}

// What the hero has put in across every street of this hand.
export function heroInvestment(streetBets) {
  return sumStreets(streetBets);
}

// What everyone else has put in, folded players included.
//
// Money from a player who folded mid-hand stays in the pot as dead money —
// that is the whole point of folding late, and excluding it would understate
// what the hero stands to win by exactly the amount that makes chasing
// worthwhile.
export function opponentsInvestment(opponents) {
  if (!Array.isArray(opponents)) return 0;
  return opponents.reduce((sum, o) => sum + sumStreets(o?.streetBets), 0);
}

// The pot, fully derived. Nothing to babysit and nothing to keep in sync —
// it is always exactly what has been entered.
export function derivePot(streetBets, opponents) {
  return heroInvestment(streetBets) + opponentsInvestment(opponents);
}

// The largest bet live on the current street, which is what everyone still in
// has to match. Folded players are excluded: their bet is dead money in the
// pot, not a price anyone has to meet.
export function currentStreetMaxBet(streetKey, heroBet, opponents) {
  const live = (Array.isArray(opponents) ? opponents : [])
    .filter((o) => !o?.folded)
    .map((o) => Number(o?.streetBets?.[streetKey]) || 0);
  return Math.max(Number(heroBet) || 0, 0, ...live);
}

// Everyone still in the hand has to have matched the same amount before a
// street can close. Returns null when they agree, or the list of who is at
// what when they do not, so the UI can name them rather than just refusing.
//
// Compared to the half-cent rather than exactly: two bets that both render as
// "$0.30" must count as equal, or the hand becomes unplayable with a mismatch
// list whose rows look identical.
export function streetMismatch(streetKey, heroBet, opponents, labelFor = (id) => `Player ${id}`) {
  const liveBets = [{ label: 'You', amount: Number(heroBet) || 0 }];
  (Array.isArray(opponents) ? opponents : []).forEach((o) => {
    if (o?.folded) return;
    liveBets.push({ label: labelFor(o.id), amount: Number(o?.streetBets?.[streetKey]) || 0 });
  });
  if (liveBets.length <= 1) return null;
  const first = liveBets[0].amount;
  return liveBets.some((b) => Math.abs(b.amount - first) > MONEY_EPSILON) ? liveBets : null;
}

// True once every seated opponent has folded, leaving the hero alone. Not the
// same as "no opponents": a hand with nobody else at the table was never
// contested, so it cannot be won by everyone folding.
export function everyoneFolded(opponents) {
  if (!Array.isArray(opponents) || opponents.length === 0) return false;
  return opponents.every((o) => o?.folded);
}

// The hero's net for a hand, given how it ended.
//
// Net is always measured against what the hero put in, never against the pot:
// winning a $100 pot you contributed $40 to is +$60, not +$100. An N-way chop
// divides the pot first and subtracts the hero's own full investment after,
// because the hero's stake is not split — only the pot is.
export function handNet({ outcome, pot, investment, splitCount = 1 }) {
  const p = Number(pot) || 0;
  const invested = Number(investment) || 0;
  if (outcome === 'win') return p - invested;
  if (outcome === 'split') {
    const ways = Number(splitCount) > 0 ? Number(splitCount) : 1;
    return p / ways - invested;
  }
  // 'loss' and 'fold' alike: the hero loses exactly what they put in.
  return -invested;
}

// What the hero nets by taking an uncontested pot after everyone folds.
// Identical to winning at showdown — the money is the same however the last
// opponent left.
export function foldWinNet(pot, investment) {
  return handNet({ outcome: 'win', pot, investment });
}

// Assembles the record that goes into the session, which is what the stats
// engines later read. `id` and `timestamp` are injected rather than generated
// here so this stays pure and testable.
export function buildHandRecord({
  id,
  timestamp,
  outcome,
  streetBets,
  opponents,
  splitCount = 1,
  foldReason,
  streetFolded,
  wonBy,
}) {
  const investment = heroInvestment(streetBets);
  const pot = derivePot(streetBets, opponents);
  return {
    id,
    gameType: 'Poker',
    outcome,
    splitCount: outcome === 'split' ? splitCount : 1,
    heroInvestment: investment,
    pot,
    netChange: handNet({ outcome, pot, investment, splitCount }),
    streets: { ...(streetBets || {}) },
    timestamp,
    ...(foldReason ? { foldReason } : {}),
    ...(streetFolded ? { streetFolded } : {}),
    ...(wonBy ? { wonBy } : {}),
  };
}
