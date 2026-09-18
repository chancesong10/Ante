import { toSplitHand, buildSplitRecord, splitRecordNet } from '../blackjackHand';

describe('toSplitHand', () => {
  test('parses the bet out of form text and nets the hand', () => {
    const h = toSplitHand({ betAmount: '25', outcome: 'win' });
    expect(h.bet).toBe(25);
    expect(h.netChange).toBe(25);
  });

  test('a doubled hand risks and wins twice the bet', () => {
    expect(toSplitHand({ betAmount: '25', outcome: 'win', doubled: true }).netChange).toBe(50);
    expect(toSplitHand({ betAmount: '25', outcome: 'loss', doubled: true }).netChange).toBe(-50);
  });

  test('a push returns the stake', () => {
    expect(toSplitHand({ betAmount: '25', outcome: 'push' }).netChange).toBe(0);
  });

  // A split hand making 21 is not a natural and does not pay 3:2. Pinning
  // this stops a later change from quietly paying the bonus on split hands.
  test('a split hand is never a natural, whatever the payout rule', () => {
    expect(toSplitHand({ betAmount: '10', outcome: 'win' }, '3:2').blackjack).toBe(false);
    expect(toSplitHand({ betAmount: '10', outcome: 'win' }, '3:2').netChange).toBe(10);
    expect(toSplitHand({ betAmount: '10', outcome: 'win' }, '6:5').netChange).toBe(10);
  });

  // NaN in a bet would flow into every sum downstream without ever throwing.
  test('an unparseable or blank bet becomes zero rather than NaN', () => {
    expect(toSplitHand({ betAmount: '', outcome: 'loss' }).bet).toBe(0);
    expect(toSplitHand({ betAmount: 'abc', outcome: 'loss' }).bet).toBe(0);
    expect(toSplitHand({ outcome: 'loss' }).netChange).toBe(-0);
    expect(Number.isNaN(toSplitHand({ betAmount: undefined, outcome: 'win' }).netChange)).toBe(false);
  });
});

describe('buildSplitRecord', () => {
  const rules = { payout: '3:2', dealerHitsSoft17: true };

  test('produces the shape finalizeSession flattens', () => {
    const r = buildSplitRecord({
      id: 'abc',
      createdAt: 1234,
      hands: [
        { betAmount: '25', outcome: 'win' },
        { betAmount: '25', outcome: 'loss' },
      ],
      rules,
    });
    expect(r.type).toBe('split');
    expect(r.id).toBe('abc');
    expect(r.createdAt).toBe(1234);
    expect(r.rules).toBe(rules);
    expect(r.hands).toHaveLength(2);
    expect(r.hands.map((h) => h.netChange)).toEqual([25, -25]);
  });

  test('each half is weighted by its own bet, not averaged', () => {
    const r = buildSplitRecord({
      id: 'a',
      createdAt: 1,
      hands: [
        { betAmount: '10', outcome: 'win' },
        { betAmount: '50', outcome: 'loss', doubled: true },
      ],
      rules,
    });
    expect(splitRecordNet(r)).toBe(10 - 100);
  });

  test('carries extra detail through without reshaping it', () => {
    const r = buildSplitRecord({
      id: 'a',
      createdAt: 1,
      hands: [{ betAmount: '5', outcome: 'push' }],
      rules,
      extra: { playerCards: ['8', '8'], dealerUp: '6' },
    });
    expect(r.playerCards).toEqual(['8', '8']);
    expect(r.dealerUp).toBe('6');
  });

  test('tolerates a missing hands array', () => {
    expect(buildSplitRecord({ id: 'a', createdAt: 1, rules }).hands).toEqual([]);
  });

  test('falls back to 3:2 when no rules are supplied', () => {
    const r = buildSplitRecord({ id: 'a', createdAt: 1, hands: [{ betAmount: '10', outcome: 'win' }] });
    expect(r.hands[0].netChange).toBe(10);
  });
});

describe('splitRecordNet', () => {
  test('sums the halves', () => {
    expect(splitRecordNet({ hands: [{ netChange: 25 }, { netChange: -10 }] })).toBe(15);
  });

  test('a malformed record is worth nothing rather than NaN', () => {
    expect(splitRecordNet(null)).toBe(0);
    expect(splitRecordNet({})).toBe(0);
    expect(splitRecordNet({ hands: [{}, { netChange: 5 }] })).toBe(5);
  });
});
