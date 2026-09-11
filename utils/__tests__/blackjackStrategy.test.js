import {
  CARD_RANKS,
  PLAYER_ACTIONS,
  DEFAULT_BLACKJACK_RULES,
  basicStrategy,
  describeHand,
  handLabel,
  normalizeBlackjackRules,
  isDeckCount,
  rulesSummary,
  calcBlackjackNet,
  calcInsuranceNet,
} from '../blackjackStrategy';

const S17 = { decks: 6, dealerHitsSoft17: false, surrender: false, payout: '3:2' };
const H17 = { ...S17, dealerHitsSoft17: true };
const play = (cards, up, rules = S17) => basicStrategy(cards, up, rules).action;

describe('describeHand', () => {
  test('totals, softness, pairs and naturals', () => {
    expect(describeHand(['A', '7'])).toMatchObject({ total: 18, soft: true, isPair: false, isBlackjack: false });
    expect(describeHand(['A', 'A'])).toMatchObject({ total: 12, soft: true, isPair: true, pairRank: 'A' });
    expect(describeHand(['10', 'A'])).toMatchObject({ total: 21, isBlackjack: true });
    expect(describeHand(['10', '6'])).toMatchObject({ total: 16, soft: false, isPair: false });
  });

  test('anything but two known ranks is null', () => {
    expect(describeHand(['K', '6'])).toBeNull();
    expect(describeHand(['5'])).toBeNull();
    expect(describeHand(null)).toBeNull();
  });

  test('labels', () => {
    expect(handLabel(['8', '8'])).toBe('Pair of 8s');
    expect(handLabel(['A', 'A'])).toBe('Pair of Aces');
    expect(handLabel(['A', '6'])).toBe('Soft 17');
    expect(handLabel(['10', 'A'])).toBe('Blackjack');
  });
});

describe('basicStrategy — hard hands', () => {
  test('stiff hands', () => {
    expect(play(['10', '2'], '3')).toBe('hit');
    expect(play(['10', '2'], '4')).toBe('stand');
    expect(play(['10', '6'], '6')).toBe('stand');
    expect(play(['10', '6'], '7')).toBe('hit');
    expect(play(['10', '6'], '10')).toBe('hit');
  });

  test('doubling totals', () => {
    expect(play(['5', '4'], '3')).toBe('double');
    expect(play(['5', '4'], '2')).toBe('hit');
    expect(play(['6', '4'], '9')).toBe('double');
    expect(play(['6', '4'], '10')).toBe('hit');
    expect(play(['6', '5'], '10')).toBe('double');
  });

  test('11 vs Ace depends on soft 17', () => {
    expect(play(['6', '5'], 'A', S17)).toBe('hit');
    expect(play(['6', '5'], 'A', H17)).toBe('double');
  });
});

describe('basicStrategy — soft hands', () => {
  test('soft 18', () => {
    expect(play(['A', '7'], '2', S17)).toBe('stand');
    expect(play(['A', '7'], '2', H17)).toBe('double');
    expect(play(['A', '7'], '6')).toBe('double');
    expect(play(['A', '7'], '7')).toBe('stand');
    expect(play(['A', '7'], '9')).toBe('hit');
  });

  test('other soft totals', () => {
    expect(play(['A', '6'], '3')).toBe('double');
    expect(play(['A', '6'], '2')).toBe('hit');
    expect(play(['A', '2'], '4')).toBe('hit');
    expect(play(['A', '2'], '5')).toBe('double');
    expect(play(['A', '4'], '4')).toBe('double');
    expect(play(['A', '8'], '6', S17)).toBe('stand');
    expect(play(['A', '8'], '6', H17)).toBe('double');
  });
});

describe('basicStrategy — pairs', () => {
  test('always and never', () => {
    expect(play(['A', 'A'], 'A')).toBe('split');
    expect(play(['8', '8'], '10')).toBe('split');
    expect(play(['10', '10'], '6')).toBe('stand');
    expect(play(['5', '5'], '9')).toBe('double');
  });

  test('upcard-dependent splits', () => {
    expect(play(['9', '9'], '7')).toBe('stand');
    expect(play(['9', '9'], '8')).toBe('split');
    expect(play(['9', '9'], 'A')).toBe('stand');
    expect(play(['7', '7'], '7')).toBe('split');
    expect(play(['7', '7'], '8')).toBe('hit');
    expect(play(['6', '6'], '2')).toBe('split');
    expect(play(['6', '6'], '7')).toBe('hit');
    expect(play(['4', '4'], '5')).toBe('split');
    expect(play(['4', '4'], '4')).toBe('hit');
    expect(play(['2', '2'], '7')).toBe('split');
    expect(play(['2', '2'], '8')).toBe('hit');
  });
});

describe('basicStrategy — surrender', () => {
  const S17S = { ...S17, surrender: true };
  const H17S = { ...H17, surrender: true };

  test('only when the table allows it', () => {
    expect(play(['10', '6'], '10', S17)).toBe('hit');
    expect(play(['10', '6'], '10', S17S)).toBe('surrender');
    expect(play(['10', '6'], '9', S17S)).toBe('surrender');
    expect(play(['9', '7'], '8', S17S)).toBe('hit');
    expect(play(['10', '5'], '10', S17S)).toBe('surrender');
  });

  test('dealer hitting soft 17 adds 15 vs A, 17 vs A, and 8-8 vs A', () => {
    expect(play(['10', '5'], 'A', S17S)).toBe('hit');
    expect(play(['10', '5'], 'A', H17S)).toBe('surrender');
    expect(play(['10', '7'], 'A', H17S)).toBe('surrender');
    expect(play(['8', '8'], 'A', S17S)).toBe('split');
    expect(play(['8', '8'], 'A', H17S)).toBe('surrender');
  });
});

describe('basicStrategy — deck count', () => {
  test('one- and two-deck games accept their own play alongside the chart', () => {
    expect(basicStrategy(['5', '4'], '2', S17).accepted).toEqual(['hit']);
    expect(basicStrategy(['5', '4'], '2', { ...S17, decks: 2 }).accepted).toEqual(['hit', 'double']);
    expect(basicStrategy(['4', '4'], '4', { ...S17, decks: 1 }).accepted).toContain('split');
    // The chart's own play is still the recommendation.
    expect(basicStrategy(['5', '4'], '2', { ...S17, decks: 2 }).action).toBe('hit');
  });
});

describe('basicStrategy — every spot', () => {
  test('a natural or incomplete input has no decision', () => {
    expect(basicStrategy(['A', '10'], '6', S17)).toBeNull();
    expect(basicStrategy(['10', '6'], null, S17)).toBeNull();
  });

  test('every starting hand vs every upcard gets a legal play under every rule set', () => {
    const actionIds = PLAYER_ACTIONS.map((a) => a.id);
    const ruleSets = [S17, H17, { ...S17, surrender: true }, { ...H17, surrender: true, decks: 1 }];
    ruleSets.forEach((rules) => {
      CARD_RANKS.forEach((a) => {
        CARD_RANKS.forEach((b) => {
          CARD_RANKS.forEach((up) => {
            const hand = describeHand([a, b]);
            const s = basicStrategy([a, b], up, rules);
            if (hand.isBlackjack) {
              expect(s).toBeNull();
              return;
            }
            expect(actionIds).toContain(s.action);
            if (!hand.isPair) expect(s.action).not.toBe('split');
            if (!rules.surrender) expect(s.action).not.toBe('surrender');
            if (!hand.isPair && !hand.soft && hand.total >= 17) expect(['stand', 'surrender']).toContain(s.action);
          });
        });
      });
    });
  });
});

describe('money', () => {
  test('payouts, doubles and surrender', () => {
    expect(calcBlackjackNet({ bet: 10, blackjack: true, outcome: 'win' })).toBe(15);
    expect(calcBlackjackNet({ bet: 10, blackjack: true, outcome: 'win', payout: '6:5' })).toBe(12);
    expect(calcBlackjackNet({ bet: 10, blackjack: true, outcome: 'push' })).toBe(0);
    expect(calcBlackjackNet({ bet: 10, doubled: true, outcome: 'win' })).toBe(20);
    expect(calcBlackjackNet({ bet: 10, doubled: true, outcome: 'loss' })).toBe(-20);
    expect(calcBlackjackNet({ bet: 10, surrendered: true, outcome: 'loss' })).toBe(-5);
  });

  test('insurance is half the bet at 2:1', () => {
    expect(calcInsuranceNet(10, true)).toBe(10);
    expect(calcInsuranceNet(10, false)).toBe(-5);
  });
});

describe('rules', () => {
  test('normalizes missing or unknown values to the defaults', () => {
    expect(normalizeBlackjackRules(undefined)).toEqual(DEFAULT_BLACKJACK_RULES);
    expect(normalizeBlackjackRules({ payout: '6:5', decks: 12, surrender: 'yes' })).toEqual({
      ...DEFAULT_BLACKJACK_RULES,
      payout: '6:5',
    });
  });

  test('any whole number of decks from 1 to 8', () => {
    expect(normalizeBlackjackRules({ decks: 4 }).decks).toBe(4);
    expect(normalizeBlackjackRules({ decks: '5' }).decks).toBe(5);
    [0, 9, 2.5, '', 'six', null].forEach((decks) => {
      expect(normalizeBlackjackRules({ decks }).decks).toBe(DEFAULT_BLACKJACK_RULES.decks);
    });
    expect(isDeckCount(8)).toBe(true);
    expect(isDeckCount(9)).toBe(false);
  });

  test('a four-deck shoe plays the multi-deck chart, with no small-deck exceptions', () => {
    expect(basicStrategy(['5', '4'], '2', { ...S17, decks: 4 }).accepted).toEqual(['hit']);
    expect(basicStrategy(['5', '4'], '2', { ...S17, decks: 2 }).accepted).toContain('double');
  });

  test('summary', () => {
    expect(rulesSummary(DEFAULT_BLACKJACK_RULES)).toBe('6 decks · S17 · BJ 3:2 · No surrender');
    expect(rulesSummary({ decks: 1, dealerHitsSoft17: true, payout: '6:5', surrender: true })).toBe(
      '1 deck · H17 · BJ 6:5 · Surrender'
    );
  });
});
