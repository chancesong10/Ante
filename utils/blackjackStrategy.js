// Hand math and basic strategy for the Blackjack tracker — pure, no React.
//
// The chart is standard multi-deck (4–8 deck) basic strategy: double on any
// first two cards, double after split allowed, late surrender when the table
// offers it, and the handful of plays that change when the dealer hits soft
// 17. One- and two-deck games shift a few marginal plays; rather than carry a
// second full chart, those specific spots accept either play as correct, so
// the tracker never calls a right play at a small-deck table a mistake.

// Suits never matter and J/Q/K play exactly like a 10, so ten buttons carry
// everything the analysis needs.
export const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export const PLAYER_ACTIONS = [
  { id: 'stand', label: 'Stand', pastTense: 'stood' },
  { id: 'hit', label: 'Hit', pastTense: 'hit' },
  { id: 'double', label: 'Double', pastTense: 'doubled' },
  { id: 'split', label: 'Split', pastTense: 'split' },
  { id: 'surrender', label: 'Surrender', pastTense: 'surrendered' },
];

export const actionLabel = (id) => PLAYER_ACTIONS.find((a) => a.id === id)?.label || id;
export const actionPastTense = (id) => PLAYER_ACTIONS.find((a) => a.id === id)?.pastTense || id;

// Any whole number of decks, from a single-deck game to an eight-deck shoe.
export const MIN_DECKS = 1;
export const MAX_DECKS = 8;

export const isDeckCount = (value) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return Number.isInteger(n) && n >= MIN_DECKS && n <= MAX_DECKS;
};

export const DEFAULT_BLACKJACK_RULES = {
  payout: '3:2',
  dealerHitsSoft17: false,
  surrender: false,
  decks: 6,
};

// Stored rules come from preferences or from a logged hand, possibly written
// by an older build — fill anything missing or unrecognised with the default.
export function normalizeBlackjackRules(rules) {
  const r = rules && typeof rules === 'object' ? rules : {};
  return {
    payout: r.payout === '6:5' ? '6:5' : '3:2',
    dealerHitsSoft17: r.dealerHitsSoft17 === true,
    surrender: r.surrender === true,
    decks: isDeckCount(r.decks) ? Number(r.decks) : DEFAULT_BLACKJACK_RULES.decks,
  };
}

export function rulesSummary(rulesInput) {
  const rules = normalizeBlackjackRules(rulesInput);
  return [
    `${rules.decks} deck${rules.decks === 1 ? '' : 's'}`,
    rules.dealerHitsSoft17 ? 'H17' : 'S17',
    `BJ ${rules.payout}`,
    rules.surrender ? 'Surrender' : 'No surrender',
  ].join(' · ');
}

export const blackjackPayoutMultiplier = (payout) => (payout === '6:5' ? 1.2 : 1.5);

// Net result of one hand, not counting the returned stake. A blackjack pays
// the table's payout; a surrender gives back half the bet.
export function calcBlackjackNet({ bet, doubled = false, blackjack = false, outcome, surrendered = false, payout = '3:2' }) {
  if (surrendered) return -bet / 2;
  const stake = doubled ? bet * 2 : bet;
  if (outcome === 'win') return blackjack ? stake * blackjackPayoutMultiplier(payout) : stake;
  if (outcome === 'loss') return -stake;
  return 0;
}

// Insurance is a side bet of half the main bet, paying 2:1 if the dealer has
// blackjack.
export function calcInsuranceNet(bet, dealerHadBlackjack) {
  const side = bet / 2;
  return dealerHadBlackjack ? side * 2 : -side;
}

// Approximate chance the dealer busts from each upcard, six decks, dealer
// standing on soft 17, with dealer blackjacks counted as not busting (which is
// how the tracker records them). Only ever used as a luck read — never to
// judge a decision.
export const DEALER_BUST_RATE = {
  '2': 35.3,
  '3': 37.6,
  '4': 40.3,
  '5': 42.9,
  '6': 42.1,
  '7': 26.0,
  '8': 23.9,
  '9': 23.3,
  '10': 21.4,
  A: 11.7,
};

export const isCardRank = (rank) => CARD_RANKS.includes(rank);
const rankValue = (rank) => (rank === 'A' ? 11 : Number(rank));

// Two starting cards -> total, softness, pair, natural. Null for anything that
// isn't exactly two known ranks.
export function describeHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 2 || !cards.every(isCardRank)) return null;
  const [a, b] = cards;
  const aces = cards.filter((c) => c === 'A').length;
  let total = rankValue(a) + rankValue(b);
  // A pair of aces is 22 counting both as 11; one of them drops to 1.
  if (total > 21) total -= 10;
  return {
    total,
    soft: aces > 0,
    isPair: a === b,
    pairRank: a === b ? a : null,
    isBlackjack: aces === 1 && (a === '10' || b === '10'),
  };
}

export function handLabel(cards) {
  const hand = describeHand(cards);
  if (!hand) return null;
  if (hand.isBlackjack) return 'Blackjack';
  if (hand.isPair) return hand.pairRank === 'A' ? 'Pair of Aces' : `Pair of ${hand.pairRank}s`;
  return `${hand.soft ? 'Soft' : 'Hard'} ${hand.total}`;
}

// "Hard 12 vs 4", "8-8 vs A" — how a spot is named when grouping decisions.
export function situationLabel(hand, dealerUp) {
  const player = hand.isPair
    ? `${hand.pairRank}-${hand.pairRank}`
    : `${hand.soft ? 'Soft' : 'Hard'} ${hand.total}`;
  return `${player} vs ${dealerUp}`;
}

// dv is the dealer upcard's value, with an Ace as 11.
function hardPlay(total, dv, rules) {
  if (total <= 8) return 'hit';
  if (total === 9) return dv >= 3 && dv <= 6 ? 'double' : 'hit';
  if (total === 10) return dv <= 9 ? 'double' : 'hit';
  if (total === 11) return dv <= 10 || rules.dealerHitsSoft17 ? 'double' : 'hit';
  if (total === 12) return dv >= 4 && dv <= 6 ? 'stand' : 'hit';
  if (total <= 16) return dv <= 6 ? 'stand' : 'hit';
  return 'stand';
}

function softPlay(total, dv, rules) {
  if (total >= 20) return 'stand';
  if (total === 19) return rules.dealerHitsSoft17 && dv === 6 ? 'double' : 'stand';
  if (total === 18) {
    if (dv >= 3 && dv <= 6) return 'double';
    if (dv === 2) return rules.dealerHitsSoft17 ? 'double' : 'stand';
    if (dv <= 8) return 'stand';
    return 'hit';
  }
  if (total === 17) return dv >= 3 && dv <= 6 ? 'double' : 'hit';
  if (total >= 15) return dv >= 4 && dv <= 6 ? 'double' : 'hit';
  return dv >= 5 && dv <= 6 ? 'double' : 'hit';
}

function pairPlay(rank, dv, rules) {
  switch (rank) {
    case 'A':
    case '8':
      return 'split';
    case '10':
      return 'stand';
    case '9':
      return dv <= 6 || dv === 8 || dv === 9 ? 'split' : 'stand';
    case '7':
      return dv <= 7 ? 'split' : 'hit';
    case '6':
      return dv <= 6 ? 'split' : 'hit';
    case '5':
      return hardPlay(10, dv, rules);
    case '4':
      return dv === 5 || dv === 6 ? 'split' : 'hit';
    default:
      // 2-2 and 3-3
      return dv <= 7 ? 'split' : 'hit';
  }
}

// Late surrender spots. Only consulted when the table allows surrender.
function shouldSurrender(hand, dv, rules) {
  if (hand.isPair && hand.pairRank === '8') return rules.dealerHitsSoft17 && dv === 11;
  if (hand.soft || hand.isPair) return false;
  if (hand.total === 16) return dv >= 9;
  if (hand.total === 15) return dv === 10 || (rules.dealerHitsSoft17 && dv === 11);
  if (hand.total === 17) return rules.dealerHitsSoft17 && dv === 11;
  return false;
}

// Plays that are correct in one- and two-deck games where the multi-deck chart
// says otherwise. Accepted alongside the chart's play, never instead of it.
function fewDeckAlternatives(hand, dv) {
  const alts = [];
  if (hand.isPair) {
    if (hand.pairRank === '7' && dv === 8) alts.push('split');
    if (hand.pairRank === '6' && dv === 7) alts.push('split');
    if (hand.pairRank === '4' && dv === 4) alts.push('split');
    if (hand.pairRank === '3' && dv === 8) alts.push('split');
    return alts;
  }
  if (hand.soft) {
    if ((hand.total === 13 || hand.total === 14) && dv === 4) alts.push('double');
    if (hand.total === 17 && dv === 2) alts.push('double');
    if (hand.total === 18 && dv === 11) alts.push('stand');
    if (hand.total === 19 && dv === 6) alts.push('double');
    return alts;
  }
  if (hand.total === 8 && (dv === 5 || dv === 6)) alts.push('double');
  if (hand.total === 9 && dv === 2) alts.push('double');
  if (hand.total === 11 && dv === 11) alts.push('double');
  return alts;
}

// The basic strategy play for two starting cards against a dealer upcard.
// Returns null for a natural (nothing to decide) or incomplete input.
// `accepted` is every play that counts as correct at this table.
export function basicStrategy(playerCards, dealerUp, rulesInput) {
  const hand = describeHand(playerCards);
  if (!hand || hand.isBlackjack || !isCardRank(dealerUp)) return null;
  const rules = normalizeBlackjackRules(rulesInput);
  const dv = rankValue(dealerUp);

  let action;
  if (rules.surrender && shouldSurrender(hand, dv, rules)) action = 'surrender';
  else if (hand.isPair) action = pairPlay(hand.pairRank, dv, rules);
  else if (hand.soft) action = softPlay(hand.total, dv, rules);
  else action = hardPlay(hand.total, dv, rules);

  const accepted = new Set([action]);
  if (rules.decks <= 2) fewDeckAlternatives(hand, dv).forEach((a) => accepted.add(a));

  return { action, accepted: [...accepted], hand };
}
