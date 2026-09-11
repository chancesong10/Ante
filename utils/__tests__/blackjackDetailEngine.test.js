import {
  hasCardDetail,
  judgeRecord,
  getDetailedRecords,
  calcStrategyAccuracy,
  calcDoublingDecisions,
  calcSituationResults,
  calcInsurance,
  calcDealerBust,
  calcTableRules,
  computeBlackjackDetailInsights,
} from '../blackjackDetailEngine';
import {
  calcBlackjackNet,
  calcInsuranceNet,
  DEFAULT_BLACKJACK_RULES,
  DEALER_BUST_RATE,
} from '../blackjackStrategy';

// ---------------------------------------------------------------------
// Records are built the way the redesigned BlackjackScreen logs them, with
// netChange from the same money helpers, so every expected number here is
// known before the engine runs.
// ---------------------------------------------------------------------

const RULES = DEFAULT_BLACKJACK_RULES;
let seq = 0;

function rec({
  cards,
  up,
  action,
  outcome = 'loss',
  bet = 10,
  endTag,
  insurance = false,
  dealerBlackjack = false,
  blackjack = false,
  rules = RULES,
} = {}) {
  const doubled = action === 'double';
  const surrendered = action === 'surrender';
  const r = {
    id: seq++,
    type: 'single',
    bet,
    doubled,
    blackjack,
    outcome: surrendered ? 'loss' : outcome,
    netChange: calcBlackjackNet({ bet, doubled, blackjack, outcome, surrendered, payout: rules.payout }),
    rules,
  };
  if (cards) {
    r.playerCards = cards;
    r.dealerUp = up;
    if (action) r.action = action;
  }
  if (endTag) r.endTag = endTag;
  if (surrendered) r.surrendered = true;
  if (insurance) {
    r.insurance = true;
    r.insuranceNet = calcInsuranceNet(bet, dealerBlackjack);
    r.dealerBlackjack = dealerBlackjack;
    r.netChange += r.insuranceNet;
  }
  return r;
}

function session(records, gameType = 'Blackjack') {
  return {
    id: `session${seq++}`,
    gameType,
    mode: 'hands',
    startTime: Date.now(),
    totalHands: records.length,
    netProfit: records.reduce((s, r) => s + r.netChange, 0),
    hands: records.slice().reverse(),
  };
}

const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

describe('records', () => {
  test('only hands with two cards and a dealer upcard carry detail', () => {
    expect(hasCardDetail(rec())).toBe(false);
    expect(hasCardDetail(rec({ cards: ['10', '6'], up: '10' }))).toBe(true);
    expect(hasCardDetail({ playerCards: ['K', '6'], dealerUp: '10' })).toBe(false);
    expect(hasCardDetail({ playerCards: ['10', '6'] })).toBe(false);
  });

  test('getDetailedRecords skips quick-logged hands and other games', () => {
    const history = [
      session([rec(), rec({ cards: ['10', '6'], up: '10', action: 'hit' })]),
      session([rec({ cards: ['10', '6'], up: '10', action: 'hit' })], 'Poker'),
    ];
    expect(getDetailedRecords(history)).toHaveLength(1);
  });
});

describe('judgeRecord', () => {
  test('correct and incorrect plays', () => {
    expect(judgeRecord(rec({ cards: ['10', '6'], up: '10', action: 'hit' }))).toMatchObject({ correct: true });
    expect(judgeRecord(rec({ cards: ['10', '2'], up: '4', action: 'hit' }))).toEqual({
      correct: false,
      recommended: 'stand',
      situation: 'Hard 12 vs 4',
    });
  });

  test('nothing to judge without a play, on a natural, or after a dealer blackjack', () => {
    expect(judgeRecord(rec({ cards: ['10', '6'], up: '10' }))).toBeNull();
    expect(judgeRecord(rec({ cards: ['A', '10'], up: '6', action: 'stand' }))).toBeNull();
    expect(judgeRecord(rec({ cards: ['10', '6'], up: 'A', action: 'hit', endTag: 'dealer_blackjack' }))).toBeNull();
  });

  test('a split is judged on the split decision', () => {
    const split = {
      id: 'split',
      type: 'split',
      hands: [
        { bet: 10, doubled: false, outcome: 'win', netChange: 10 },
        { bet: 10, doubled: true, outcome: 'loss', netChange: -20 },
      ],
      playerCards: ['8', '8'],
      dealerUp: '6',
      action: 'split',
      rules: RULES,
    };
    expect(judgeRecord(split)).toMatchObject({ correct: true, situation: '8-8 vs 6' });
    const [pairs] = calcSituationResults([split]);
    expect(pairs.id).toBe('pair');
    expect(pairs.vsWeak.net).toBe(-10);
    expect(pairs.vsWeak.roi).toBeCloseTo((-10 / 30) * 100, 6);
  });
});

describe('calcStrategyAccuracy', () => {
  test('rate and the most common mistake', () => {
    const records = [
      rec({ cards: ['10', '6'], up: '10', action: 'hit' }),
      rec({ cards: ['10', '2'], up: '4', action: 'hit' }),
      rec({ cards: ['10', '2'], up: '4', action: 'hit' }),
      rec({ cards: ['6', '5'], up: '6', action: 'double', outcome: 'win' }),
      rec({ cards: ['10', '6'], up: '10' }), // no play logged — not judged
    ];
    const acc = calcStrategyAccuracy(records);
    expect(acc).toMatchObject({ judged: 4, correct: 2, mistakeCount: 2, rate: 50 });
    expect(acc.topMistakes).toEqual([
      { situation: 'Hard 12 vs 4', action: 'hit', recommended: 'stand', count: 2, net: -20 },
    ]);
  });

  test('null when nothing can be judged', () => {
    expect(calcStrategyAccuracy([rec(), rec({ cards: ['10', '6'], up: '10' })])).toBeNull();
  });
});

describe('calcDoublingDecisions', () => {
  test('taken, missed, and doubles to avoid', () => {
    const d = calcDoublingDecisions([
      rec({ cards: ['6', '5'], up: '6', action: 'double', outcome: 'win' }),
      rec({ cards: ['6', '4'], up: '5', action: 'hit' }),
      rec({ cards: ['10', '2'], up: '2', action: 'double' }),
    ]);
    expect(d).toEqual({ chances: 2, taken: 1, missed: 1, takenRate: 50, doubles: 2, badDoubles: 1 });
  });

  test('a double that is right at a two-deck table is not a bad double', () => {
    const d = calcDoublingDecisions([rec({ cards: ['5', '4'], up: '2', action: 'double', rules: { ...RULES, decks: 2 } })]);
    expect(d).toMatchObject({ chances: 0, doubles: 1, badDoubles: 0, takenRate: null });
  });
});

describe('calcSituationResults', () => {
  test('groups by starting hand and dealer strength', () => {
    const rows = calcSituationResults([
      rec({ cards: ['10', '6'], up: '5', action: 'stand', outcome: 'win' }),
      rec({ cards: ['10', '6'], up: '10', action: 'hit', outcome: 'loss' }),
      rec({ cards: ['A', '7'], up: '9', action: 'hit', outcome: 'win' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['stiff', 'soft']);
    expect(rows[0].vsWeak).toEqual({ sample: 1, net: 10, roi: 100 });
    expect(rows[0].vsStrong).toEqual({ sample: 1, net: -10, roi: -100 });
    expect(rows[1].vsWeak.sample).toBe(0);
  });
});

describe('calcInsurance', () => {
  test('counts offers, takes, and the side-bet result', () => {
    const ins = calcInsurance([
      rec({ cards: ['10', '6'], up: 'A', insurance: true, dealerBlackjack: true, endTag: 'dealer_blackjack' }),
      rec({ cards: ['10', '9'], up: 'A', action: 'stand', outcome: 'win', insurance: true }),
      rec({ cards: ['10', '7'], up: 'A', action: 'stand' }),
      rec({ cards: ['10', '7'], up: '9', action: 'stand' }),
    ]);
    expect(ins).toEqual({ offered: 3, taken: 2, net: 10 - 5 });
  });

  test('null when the dealer never showed an Ace', () => {
    expect(calcInsurance([rec({ cards: ['10', '7'], up: '9', action: 'stand' })])).toBeNull();
  });
});

describe('calcDealerBust', () => {
  test('only tagged hands the dealer played out count', () => {
    const bust = calcDealerBust([
      rec({ cards: ['10', '2'], up: '6', action: 'stand', outcome: 'win', endTag: 'dealer_bust' }),
      rec({ cards: ['10', '2'], up: '5', action: 'stand', outcome: 'loss', endTag: 'dealer_higher' }),
      rec({ cards: ['10', '2'], up: '10', action: 'stand', outcome: 'win', endTag: 'dealer_bust' }),
      rec({ cards: ['10', '2'], up: '9', action: 'hit', outcome: 'loss', endTag: 'player_bust' }),
      rec({ cards: ['10', '2'], up: '7', action: 'hit', outcome: 'loss' }),
    ]);
    expect(bust.weak).toEqual({
      sample: 2,
      busts: 1,
      rate: 50,
      expectedRate: (DEALER_BUST_RATE['6'] + DEALER_BUST_RATE['5']) / 2,
    });
    expect(bust.strong).toEqual({ sample: 1, busts: 1, rate: 100, expectedRate: DEALER_BUST_RATE['10'] });
  });
});

describe('calcTableRules', () => {
  test('share of hands by rule, and what 6:5 cost on blackjacks', () => {
    const sixFive = { ...RULES, payout: '6:5' };
    const history = [
      session([
        ...repeat(8, () => rec({ rules: sixFive })),
        ...repeat(2, () => rec({ blackjack: true, outcome: 'win', rules: sixFive })),
        ...repeat(10, () => rec({ rules: { ...RULES, dealerHitsSoft17: true } })),
        { type: 'single', bet: 10, outcome: 'win', netChange: 10 }, // older hand, no rules
      ]),
    ];
    const t = calcTableRules(history);
    expect(t).toMatchObject({ hands: 20, sixFiveHands: 10, sixFiveShare: 50, sixFiveBlackjacks: 2, h17Hands: 10, h17Share: 50 });
    expect(t.sixFiveCost).toBeCloseTo(6, 10); // 2 × $10 × (1.5 − 1.2)
  });
});

describe('leaks (via computeBlackjackDetailInsights)', () => {
  const idsFor = (records) => computeBlackjackDetailInsights([session(records)]).leaks.map((l) => l.id);

  test('flags strategy mistakes under 90% accuracy, with the most common one', () => {
    const records = [
      ...repeat(15, () => rec({ cards: ['10', '6'], up: '10', action: 'hit' })),
      ...repeat(5, () => rec({ cards: ['10', '2'], up: '4', action: 'hit' })),
    ];
    const { leaks } = computeBlackjackDetailInsights([session(records)]);
    expect(leaks.map((l) => l.id)).toEqual(['strategy_mistakes']);
    expect(leaks[0].rate).toBe(75);
    expect(leaks[0].topMistake.situation).toBe('Hard 12 vs 4');
  });

  test('no strategy leak at 95%', () => {
    const records = [
      ...repeat(19, () => rec({ cards: ['10', '6'], up: '10', action: 'hit' })),
      rec({ cards: ['10', '2'], up: '4', action: 'hit' }),
    ];
    expect(idsFor(records)).toEqual([]);
  });

  test('flags missed doubles', () => {
    const records = [
      ...repeat(2, () => rec({ cards: ['6', '5'], up: '6', action: 'double', outcome: 'win' })),
      ...repeat(6, () => rec({ cards: ['6', '5'], up: '6', action: 'hit', outcome: 'win' })),
    ];
    expect(idsFor(records)).toEqual(['missed_doubles']);
  });

  test('flags taking insurance', () => {
    const records = repeat(3, () => rec({ cards: ['10', '9'], up: 'A', action: 'stand', outcome: 'win', insurance: true }));
    expect(idsFor(records)).toEqual(['insurance']);
  });

  test('flags playing mostly 6:5 tables', () => {
    expect(idsFor(repeat(20, () => rec({ rules: { ...RULES, payout: '6:5' } })))).toEqual(['six_five_tables']);
  });
});
