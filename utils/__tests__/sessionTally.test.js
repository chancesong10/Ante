import {
  expandHands,
  appendHand,
  tallyHands,
  liveNetOf,
  liveCountOf,
  liveTallyOf,
  handsOf,
  winRateOf,
  extent,
} from '../sessionTally';

// A split is one stored record holding two real hands, so every count in the
// app has to expand it first. This was copy-pasted in eight places before it
// lived here, and the copies had already drifted — three of them omitted the
// guard below, which is what these first tests pin.
describe('expandHands', () => {
  test('a split record counts as the hands inside it', () => {
    const records = [
      { id: 'a', outcome: 'win' },
      { id: 'b', type: 'split', hands: [{ outcome: 'win' }, { outcome: 'loss' }] },
    ];
    expect(expandHands(records)).toHaveLength(3);
  });

  test('a split record with no hands contributes nothing rather than undefined', () => {
    // The drifted copies put `undefined` in the list here, which threw on the
    // next property read instead of being skipped.
    expect(expandHands([{ type: 'split' }])).toEqual([]);
    expect(expandHands([{ type: 'split', hands: null }])).toEqual([]);
  });

  test('a missing or non-array hand list is empty, not a throw', () => {
    expect(expandHands(undefined)).toEqual([]);
    expect(expandHands(null)).toEqual([]);
    expect(expandHands({})).toEqual([]);
  });

  test('null entries are skipped', () => {
    expect(expandHands([null, { outcome: 'win' }, undefined])).toHaveLength(1);
  });
});

describe('appendHand', () => {
  test('appends in the caller’s own order', () => {
    const out = [];
    const records = [{ id: 'first' }, { id: 'second' }];
    for (let i = records.length - 1; i >= 0; i--) appendHand(out, records[i]);
    expect(out.map((h) => h.id)).toEqual(['second', 'first']);
  });
});

describe('tallyHands', () => {
  const hands = [
    { outcome: 'win', bet: 10, netChange: 10 },
    { outcome: 'loss', bet: 20, netChange: -20 },
    { outcome: 'loss', bet: 10, doubled: true, netChange: -20 },
    { outcome: 'push', bet: 10, netChange: 0 },
    { outcome: 'fold', bet: 5, netChange: -5, foldReason: 'bluffed' },
    { outcome: 'fold', bet: 5, netChange: -5, foldReason: 'good_fold' },
    { outcome: 'split', bet: 10, netChange: 5 },
  ];

  test('counts every outcome separately', () => {
    const t = tallyHands(hands);
    expect(t.count).toBe(7);
    expect(t.wins).toBe(1);
    expect(t.losses).toBe(2);
    expect(t.pushes).toBe(1);
    expect(t.folds).toBe(2);
    expect(t.splits).toBe(1);
    expect(t.bluffedFolds).toBe(1);
    expect(t.goodFolds).toBe(1);
  });

  // The callers genuinely disagree about which outcomes belong together — a
  // completed record folds folds into losses, the live tracker shows them
  // apart — so this must stay raw and let them combine.
  test('losses does not silently include folds', () => {
    expect(tallyHands([{ outcome: 'fold', netChange: -5 }]).losses).toBe(0);
  });

  test('sums net, and gross wins and losses either side of zero', () => {
    const t = tallyHands(hands);
    expect(t.net).toBe(-35);
    expect(t.grossWins).toBe(15);
    expect(t.grossLosses).toBe(50);
  });

  test('wagered counts a doubled bet twice — that is the money at risk', () => {
    expect(tallyHands([{ bet: 10, doubled: true }]).wagered).toBe(20);
    expect(tallyHands([{ bet: 10 }]).wagered).toBe(10);
  });

  test('a missing netChange or bet is zero, never NaN', () => {
    const t = tallyHands([{ outcome: 'win' }, { outcome: 'loss' }]);
    expect(t.net).toBe(0);
    expect(t.wagered).toBe(0);
  });

  test('expands splits before counting', () => {
    const t = tallyHands([
      { type: 'split', hands: [{ outcome: 'win', bet: 10, netChange: 10 }, { outcome: 'loss', bet: 10, netChange: -10 }] },
    ]);
    expect(t.count).toBe(2);
    expect(t.wins).toBe(1);
    expect(t.losses).toBe(1);
    expect(t.net).toBe(0);
  });

  test('an empty list tallies to zeroes, and each call gets its own object', () => {
    const a = tallyHands([]);
    const b = tallyHands(null);
    expect(a.count).toBe(0);
    expect(a.net).toBe(0);
    a.net = 99;
    expect(b.net).toBe(0);
  });
});

describe('liveNetOf / liveCountOf', () => {
  test('a hand-based session sums its hands', () => {
    const session = { hands: [{ netChange: 25 }, { netChange: -10 }] };
    expect(liveNetOf(session)).toBe(15);
    expect(liveCountOf(session)).toBe(2);
  });

  test('a buy-in session is the difference once both halves are entered', () => {
    expect(liveNetOf({ hands: [], buyIn: 100, cashOut: 140 })).toBe(40);
  });

  // Until a cash-out is entered there is no known live balance, and treating
  // the missing one as zero would report the buy-in as a total loss.
  test('a buy-in with no cash-out yet is zero, not a loss of the buy-in', () => {
    expect(liveNetOf({ hands: [], buyIn: 100, cashOut: null })).toBe(0);
    expect(liveNetOf({ hands: [], buyIn: 100 })).toBe(0);
  });

  test('no session at all is zero', () => {
    expect(liveNetOf(null)).toBe(0);
    expect(liveCountOf(undefined)).toBe(0);
  });
});

// The trackers memoise on this, so a fresh `[]` each call would defeat the
// memo entirely — it would recompute on every render instead of every hand.
describe('handsOf', () => {
  test('returns the same array every time there is no session', () => {
    expect(handsOf(null)).toBe(handsOf(undefined));
    expect(handsOf({})).toBe(handsOf({ hands: 'not an array' }));
    expect(handsOf(null)).toEqual([]);
  });

  test('passes a real hand list straight through', () => {
    const hands = [{ outcome: 'win' }];
    expect(handsOf({ hands })).toBe(hands);
  });
});

describe('winRateOf', () => {
  test('is a percentage of decided hands', () => {
    expect(winRateOf(3, 1)).toBe(75);
  });

  test('nothing decided is zero rather than NaN', () => {
    expect(winRateOf(0, 0)).toBe(0);
  });
});

// Math.max(...arr) throws a RangeError once the list is long enough, which is
// exactly the history size the screens using this are built to celebrate.
describe('extent', () => {
  test('finds min and max', () => {
    expect(extent([3, -7, 0, 12])).toEqual({ min: -7, max: 12 });
  });

  test('survives a list far longer than the argument limit', () => {
    const long = Array.from({ length: 200000 }, (_, i) => i - 100000);
    expect(() => extent(long)).not.toThrow();
    expect(extent(long)).toEqual({ min: -100000, max: 99999 });
  });
});

describe('liveTallyOf', () => {
  test('returns net and count together for a hand-based session', () => {
    const session = { hands: [{ type: 'split', hands: [{ netChange: 10 }, { netChange: -4 }] }, { netChange: 6 }] };
    expect(liveTallyOf(session)).toEqual({ net: 12, count: 3 });
  });

  // A buy-in session has no hands to count, and its net is the pair.
  test('a buy-in session has a net but nothing logged', () => {
    expect(liveTallyOf({ hands: [], buyIn: 50, cashOut: 20 })).toEqual({ net: -30, count: 0 });
  });

  test('nothing entered yet is zero on both counts', () => {
    expect(liveTallyOf({ hands: [], buyIn: 50 })).toEqual({ net: 0, count: 0 });
    expect(liveTallyOf(null)).toEqual({ net: 0, count: 0 });
  });
});
