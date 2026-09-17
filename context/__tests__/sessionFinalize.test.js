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
  loadActiveSessions: jest.fn(async () => ({})),
  saveActiveSessions: jest.fn(async () => true),
  clearLegacyActiveSession: jest.fn(async () => true),
}));

const { sessionHasContent, finalizeSession, sanitizeSessionRecord } = require('../SessionContext');

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


// A malformed record reaching a screen is a render throw, and because these
// records are persisted, that throw repeats on every launch. The boundary in
// components/AppErrorBoundary catches it; this keeps it from happening.
describe('sanitizeSessionRecord', () => {
  const valid = {
    id: 'abc',
    gameType: 'Poker',
    startTime: 1700000000000,
    hands: [{ id: 'h1', netChange: 5 }],
  };

  test('passes a well-formed record through untouched', () => {
    expect(sanitizeSessionRecord(valid)).toBe(valid);
  });

  test.each([
    ['null', null],
    ['a non-object', 'nope'],
    ['no id', { ...valid, id: undefined }],
    ['an empty id', { ...valid, id: '' }],
    ['no startTime', { ...valid, startTime: undefined }],
    ['a non-numeric startTime', { ...valid, startTime: 'yesterday' }],
    ['no gameType', { ...valid, gameType: undefined }],
  ])('rejects a record with %s', (_label, record) => {
    expect(sanitizeSessionRecord(record)).toBeNull();
  });

  test('normalizes a missing hands array rather than dropping the record', () => {
    // Screens call .map on this directly, but the record is still the user's.
    const out = sanitizeSessionRecord({ ...valid, hands: undefined });
    expect(out).not.toBeNull();
    expect(out.hands).toEqual([]);
    expect(out.id).toBe('abc');
  });
});

// A session's date label used to be computed once at finalize time and stored
// on the record, which meant a session ended yesterday kept the literal string
// "Today at 8:42 PM" forever — every old session in History claimed to be from
// today. The label must be derived from startTime at render, never persisted.
describe('session date labels are derived, not frozen', () => {
  const { formatSessionDateTime } = require('../SessionContext');

  test('a finalized record carries no precomputed date string', () => {
    const record = finalizeSession(baseSession({ buyIn: 100, cashOut: 150 }));
    expect(record.formattedDate).toBeUndefined();
    // The real instant is still there for the renderer to format.
    expect(Number.isFinite(record.startTime)).toBe(true);
    expect(typeof record.rawDate).toBe('string');
  });

  test('a hands-mode record carries no precomputed date string either', () => {
    const record = finalizeSession(
      baseSession({ hands: [{ bet: 25, outcome: 'win', netChange: 25 }] })
    );
    expect(record.formattedDate).toBeUndefined();
    expect(Number.isFinite(record.startTime)).toBe(true);
  });

  test('a timestamp from yesterday is never labelled Today', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 42);
    const label = formatSessionDateTime(yesterday.getTime());
    expect(label).toMatch(/^Yesterday at /);
    expect(label).not.toMatch(/Today/);
  });

  test('an older timestamp gets an explicit calendar date', () => {
    const now = new Date();
    const lastWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8, 20, 42);
    const label = formatSessionDateTime(lastWeek.getTime());
    // MM/DD/YYYY at h:mm AM — an absolute date, not a relative word.
    expect(label).toMatch(/^\d{2}\/\d{2}\/\d{4} at /);
    expect(label).not.toMatch(/Today|Yesterday/);
  });

  test("today's timestamp still reads Today", () => {
    const label = formatSessionDateTime(Date.now());
    expect(label).toMatch(/^Today at /);
  });
});
