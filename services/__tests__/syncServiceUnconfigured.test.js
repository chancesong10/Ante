// A build without Supabase keys has no client (see supabaseClient.js). Sync
// calls there must come back as ordinary errors, not throw on a null client.

jest.mock('../supabaseClient', () => ({ supabase: null }));

const { pullSessions, pushSessions, deleteCloudSessions } = require('../syncService');

test('every sync call returns an error instead of crashing', async () => {
  expect((await pullSessions('user-1')).error).toBeTruthy();
  expect((await pushSessions('user-1', [{ id: 'a', startTime: 0, endTime: 0 }])).error).toBeTruthy();
  expect((await deleteCloudSessions('user-1', ['a'])).error).toBeTruthy();
});

test('signed out stays a no-op, with no error', async () => {
  expect(await pullSessions(null)).toEqual({ sessions: [], error: null });
  expect(await pushSessions(null, [])).toEqual({ error: null });
});