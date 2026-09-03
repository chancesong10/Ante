// Pure-helper coverage for SessionContext: `sessionHasContent` (the guard
// that stops an untouched session becoming a phantom $0 / 0-hand row in
// History) and the `finalizeSession` shape it protects.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(32)),
}));

jest.mock('../../services/storageService', () => ({
  loadSessionHistory: jest.fn(async () => []),
  saveSessionHistory: jest.fn(async () => true),
  loadActiveSession: jest.fn(async () => null),
  saveActiveSession: jest.fn(async () => true),
}));

const { sessionHasContent, finalizeSession } = require('../SessionContext');

const baseSession = (over = {}) => ({
  id: 's1',
  gameType: 'Blackjack',
  startTime: Date.now() - 60000,
  hands: [],
  buyIn: null,
  cashOut: null,
  ...over,
});

describe('sessionHasContent', () => {
  test('a freshly started session (no hands, no buy-in/cash-out) has no content', () => {
    expect(sessionHasContent(baseSession())).toBe(false);
  });

  test('one logged hand counts as content', () => {
    expect(sessionHasContent(baseSession({ hands: [{ id: 'h1', outcome: 'win', netChange: 10 }] }))).toBe(true);
  });

  test('a completed buy-in / cash-out pair counts as content', () => {
    expect(sessionHasContent(baseSession({ buyIn: 100, cashOut: 150 }))).toBe(true);
  });

  test('a buy-in with no cash-out yet does NOT count (would finalize as an empty hands session)', () => {
    expect(sessionHasContent(baseSession({ buyIn: 100 }))).toBe(false);
  });

  test('NaN / non-finite buy-in or cash-out does not count as content', () => {
    expect(sessionHasContent(baseSession({ buyIn: NaN, cashOut: NaN }))).toBe(false);
    expect(sessionHasContent(baseSession({ buyIn: 100, cashOut: NaN }))).toBe(false);
  });

  test('overrides (as passed by endActiveSession) are respected', () => {
    expect(sessionHasContent(baseSession(), 100, 150)).toBe(true);
    expect(sessionHasContent(baseSession(), 100, null)).toBe(false);
  });

  test('null session is safe', () => {
    expect(sessionHasContent(null)).toBe(false);
  });
});

describe('finalizeSession still produces a valid record when there IS content', () => {
  test('buy-in / cash-out session', () => {
    const rec = finalizeSession(baseSession({ gameType: 'General', buyIn: 100, cashOut: 150 }));
    expect(rec.mode).toBe('buyInCashOut');
    expect(rec.netProfit).toBe(50);
  });

  test('hands session', () => {
    const rec = finalizeSession(
      baseSession({
        hands: [
          { id: 'h2', outcome: 'loss', netChange: -10 },
          { id: 'h1', outcome: 'win', netChange: 25 },
        ],
      })
    );
    expect(rec.mode).toBe('hands');
    expect(rec.totalHands).toBe(2);
    expect(rec.netProfit).toBe(15);
  });
});
