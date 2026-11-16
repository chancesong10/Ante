// pullSessions must return an account's *complete* session list: the sync
// engine reads a synced session missing from a successful pull as deleted on
// another device, so a silently truncated pull would delete local data.

const mockPages = [];
const mockQueries = [];

jest.mock('../supabaseClient', () => {
  function makeQuery() {
    const query = { filters: [] };
    const chain = {
      select: () => chain,
      eq: (col, val) => {
        query.filters.push(['eq', col, val]);
        return chain;
      },
      order: () => chain,
      limit: (n) => {
        query.limit = n;
        return chain;
      },
      gt: (col, val) => {
        query.filters.push(['gt', col, val]);
        return chain;
      },
      then: (resolve, reject) => {
        mockQueries.push(query);
        const next = mockPages.shift() ?? { data: [], error: null };
        return Promise.resolve(next).then(resolve, reject);
      },
    };
    return chain;
  }
  return { supabase: { from: () => makeQuery() } };
});

const { pullSessions } = require('../syncService');

function rows(ids) {
  return ids.map((id) => ({ id, data: { id } }));
}

beforeEach(() => {
  mockPages.length = 0;
  mockQueries.length = 0;
});

test('pages past a server row cap smaller than the page size', async () => {
  // A server capping responses at 2 rows: every page is "short", so stopping
  // on a short page would return only the first two sessions.
  mockPages.push(
    { data: rows(['a', 'b']), error: null },
    { data: rows(['c', 'd']), error: null },
    { data: rows(['e']), error: null },
    { data: [], error: null }
  );

  const { sessions, error } = await pullSessions('user-1');

  expect(error).toBeNull();
  expect(sessions.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  // Keyset cursor: each page starts after the last id of the one before.
  expect(mockQueries.map((q) => q.filters.find(([op]) => op === 'gt')?.[2])).toEqual([
    undefined,
    'b',
    'd',
    'e',
  ]);
  expect(mockQueries.every((q) => q.filters.some(([op, col, val]) => op === 'eq' && col === 'user_id' && val === 'user-1'))).toBe(true);
});

test('an error on any page fails the whole pull rather than returning part of it', async () => {
  mockPages.push(
    { data: rows(['a', 'b']), error: null },
    { data: null, error: { message: 'timeout' } }
  );
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const { sessions, error } = await pullSessions('user-1');

  expect(error).toEqual({ message: 'timeout' });
  expect(sessions).toEqual([]);
  console.error.mockRestore();
});

test('no user means no request', async () => {
  const { sessions, error } = await pullSessions(null);
  expect(sessions).toEqual([]);
  expect(error).toBeNull();
  expect(mockQueries).toHaveLength(0);
});
