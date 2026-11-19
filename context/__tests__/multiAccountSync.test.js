// Exercises the real SessionContext + SyncContext code (not a reimplementation of
// its logic) against mocked storage/network to answer, mechanically, the questions
// raised while testing login on-device:
//   - does local session history survive sign-out?
//   - does a second account inherit/re-push the first account's synced sessions?
//   - can a failed cloud pull (e.g. the PGRST303 clock-skew error seen on-device)
//     explain "pushed 3, only see 3, missing the 4th" even though the push itself
//     succeeded?
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
    }),
    getRandomBytesAsync: jest.fn(async () => new Uint8Array(32)),
  };
});

jest.mock('../../services/storageService', () => ({
  loadSessionHistory: jest.fn(async () => []),
  saveSessionHistory: jest.fn(async () => true),
  loadActiveSessions: jest.fn(async () => ({})),
  saveActiveSessions: jest.fn(async () => true),
  clearLegacyActiveSession: jest.fn(async () => true),
  loadPendingCloudDeletes: jest.fn(async () => []),
  addPendingCloudDeletes: jest.fn(async () => {}),
  removePendingCloudDeletes: jest.fn(async () => {}),
}));

jest.mock('../../services/syncService', () => ({
  pushSessions: jest.fn(async () => ({ error: null })),
  pullSessions: jest.fn(async () => ({ sessions: [], error: null })),
  deleteCloudSessions: jest.fn(async () => ({ error: null })),
}));

jest.mock('../AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

const { SessionProvider, useSessionHistory, useActiveSession } = require('../SessionContext');
const { useSyncEngine, TRANSIENT_RETRY_DELAY_MS } = require('../SyncContext');
const { useAuth } = require('../AuthContext');
const { pushSessions, pullSessions, deleteCloudSessions } = require('../../services/syncService');
const {
  loadSessionHistory,
  loadActiveSessions,
  saveSessionHistory,
  loadPendingCloudDeletes,
  addPendingCloudDeletes,
  removePendingCloudDeletes,
} = require('../../services/storageService');

let latestApi = null;

function Harness() {
  useSyncEngine();
  const history = useSessionHistory();
  const active = useActiveSession();
  latestApi = { ...history, ...active };
  return null;
}

// Fake timers throughout, since withTransientRetry's retry delay is a real
// setTimeout — flushing microtasks alone would never let a pending retry
// fire, and leaving it on real timers risks a stray callback firing during
// (and corrupting) a later, unrelated test.
async function flush() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}

async function advanceRetryDelay() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(TRANSIENT_RETRY_DELAY_MS);
  });
}

// Unmounted after each test so a foreground event emitted by a later test
// doesn't also wake an earlier test's sync engine.
const mounted = [];

async function renderApp() {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SessionProvider>
        <Harness />
      </SessionProvider>
    );
  });
  mounted.push(renderer);
  await flush();
  return renderer;
}

async function signIn(renderer, userId) {
  useAuth.mockReturnValue({ user: userId ? { id: userId } : null });
  await act(async () => {
    renderer.update(
      <SessionProvider>
        <Harness />
      </SessionProvider>
    );
  });
  await flush();
}

function createBuyInSession(buyIn, cashOut) {
  act(() => {
    latestApi.startSession('Poker');
  });
  act(() => {
    latestApi.endActiveSession('Poker', buyIn, cashOut);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  loadSessionHistory.mockResolvedValue([]);
  loadActiveSessions.mockResolvedValue({});
  pushSessions.mockResolvedValue({ error: null });
  pullSessions.mockResolvedValue({ sessions: [], error: null });
  deleteCloudSessions.mockResolvedValue({ error: null });
  loadPendingCloudDeletes.mockResolvedValue([]);
  useAuth.mockReturnValue({ user: null });
  latestApi = null;
});

// Simulates the app's foreground event, which re-runs reconciliation.
async function foreground() {
  const { AppState } = require('react-native');
  await act(async () => {
    AppState.__emit('active');
  });
  await flush();
}

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((renderer) => renderer.unmount());
  });
  jest.useRealTimers();
});

test('signing in pushes existing local sessions to the cloud, tagged with the signed-in user', async () => {
  const renderer = await renderApp();

  createBuyInSession(100, 150);
  createBuyInSession(50, 20);
  createBuyInSession(200, 400);
  expect(latestApi.sessionHistory).toHaveLength(3);

  await signIn(renderer, 'A');

  expect(pullSessions).toHaveBeenCalledWith('A');
  // The reconciliation effect only flips hasReconciled once its own async
  // pull/push has fully resolved, so the write-through effect can't see a
  // half-finished reconciliation as "safe to write-through" and duplicate
  // the push (see the isReconciling guard in SyncContext.js).
  expect(pushSessions).toHaveBeenCalledTimes(1);
  const [pushedUserId, pushedSessions] = pushSessions.mock.calls[0];
  expect(pushedUserId).toBe('A');
  expect(pushedSessions).toHaveLength(3);

  expect(latestApi.sessionHistory).toHaveLength(3);
  expect(latestApi.sessionHistory.every((s) => s.syncedUserId === 'A')).toBe(true);
});

test('local session history survives sign-out (AsyncStorage is not cleared)', async () => {
  const renderer = await renderApp();
  createBuyInSession(100, 150);
  await signIn(renderer, 'A');
  expect(latestApi.sessionHistory).toHaveLength(1);

  await signIn(renderer, null); // sign out

  // The account-scoped sync bookkeeping resets, but the actual local data does not.
  expect(latestApi.sessionHistory).toHaveLength(1);
  expect(latestApi.sessionHistory[0].syncedUserId).toBe('A');
});

test('switching to a second account does not re-push or reassign the first account\'s sessions, but they remain visible locally', async () => {
  const renderer = await renderApp();
  createBuyInSession(100, 150);
  createBuyInSession(50, 20);
  await signIn(renderer, 'A'); // A pushes 2 sessions
  await signIn(renderer, null); // sign out
  pushSessions.mockClear();
  pullSessions.mockClear();

  await signIn(renderer, 'B'); // sign into a different account on the same device

  expect(pullSessions).toHaveBeenCalledWith('B');
  // The account-switch guard in useSyncEngine must exclude A's sessions from
  // anything pushed while signed in as B.
  if (pushSessions.mock.calls.length > 0) {
    const [, pushedSessions] = pushSessions.mock.calls[0];
    expect(pushedSessions.some((s) => s.syncedUserId === 'A')).toBe(false);
  }

  // Database-side, A's sessions were never touched under B's account.
  expect(latestApi.sessionHistory.every((s) => s.syncedUserId !== 'B')).toBe(true);

  // But locally, on this device, B's screens would still render A's 2 sessions —
  // nothing filters sessionHistory by the currently signed-in user.
  expect(latestApi.sessionHistory).toHaveLength(2);
  expect(latestApi.sessionHistory.every((s) => s.syncedUserId === 'A')).toBe(true);
});

test('a transient pull failure (PGRST303) is retried once and recovers the missing cloud session', async () => {
  // Reproduces, and confirms the fix for: friend pushes 1 session to account A
  // on another device; this device has 3 local (unsynced) sessions and signs
  // into A. The first pull hits the same clock-skew race seen on-device; the
  // retry (issued ~1.5s later, by which point the race has resolved) succeeds
  // and picks up the session that would otherwise have been silently lost.
  const friendSession = {
    id: '00000000-0000-4000-8000-0000009999ff',
    gameType: 'Poker',
    startTime: Date.now(),
    endTime: Date.now(),
    mode: 'buyInCashOut',
    buyIn: 100,
    cashOut: 300,
    netProfit: 200,
  };
  pullSessions
    .mockResolvedValueOnce({
      sessions: [],
      error: { code: 'PGRST303', message: 'JWT issued at future' },
    })
    .mockResolvedValueOnce({ sessions: [friendSession], error: null });

  const renderer = await renderApp();
  createBuyInSession(100, 150);
  createBuyInSession(50, 20);
  createBuyInSession(200, 400);

  useAuth.mockReturnValue({ user: { id: 'A' } });
  await act(async () => {
    renderer.update(
      <SessionProvider>
        <Harness />
      </SessionProvider>
    );
  });
  await flush(); // lets the first (failing) pull attempt resolve
  await advanceRetryDelay(); // fires the retry's setTimeout
  await flush(); // lets the retry, merge, and push settle

  expect(pullSessions).toHaveBeenCalledTimes(2);
  expect(pushSessions).toHaveBeenCalledTimes(1);
  const [, pushedSessions] = pushSessions.mock.calls[0];
  expect(pushedSessions).toHaveLength(3); // this device's own push, unaffected

  // The friend's session is no longer missing — the retry recovered it.
  expect(latestApi.sessionHistory).toHaveLength(4);
  expect(latestApi.sessionHistory.some((s) => s.id === friendSession.id)).toBe(true);
});

test('if the retry also fails, the session stays missing rather than retrying indefinitely', async () => {
  const transientError = { code: 'PGRST303', message: 'JWT issued at future' };
  pullSessions.mockResolvedValue({ sessions: [], error: transientError });

  const renderer = await renderApp();
  createBuyInSession(100, 150);

  useAuth.mockReturnValue({ user: { id: 'A' } });
  await act(async () => {
    renderer.update(
      <SessionProvider>
        <Harness />
      </SessionProvider>
    );
  });
  await flush();
  await advanceRetryDelay();
  await flush();

  // Exactly one retry — not zero (no retry at all) and not an unbounded loop.
  expect(pullSessions).toHaveBeenCalledTimes(2);
  expect(latestApi.sessionHistory).toHaveLength(1); // only this device's own session
});

test('a successful pull merges a cloud session created on another device', async () => {
  pullSessions.mockResolvedValueOnce({
    sessions: [
      {
        id: '00000000-0000-4000-8000-0000009999ff',
        gameType: 'Poker',
        startTime: Date.now(),
        endTime: Date.now(),
        mode: 'buyInCashOut',
        buyIn: 100,
        cashOut: 300,
        netProfit: 200,
      },
    ],
    error: null,
  });

  const renderer = await renderApp();
  await signIn(renderer, 'A');

  expect(latestApi.sessionHistory).toHaveLength(1);
  expect(latestApi.sessionHistory[0].syncedUserId).toBe('A');
});

// Deleting an account is the one case where a syncedUserId can name an account
// that no longer exists. useVisibleSessionHistory hides any session whose
// syncedUserId isn't the signed-in user, so without releaseAccountSessions
// those records would sit in local storage permanently invisible.
test('releasing a deleted account\'s sessions un-tags them and leaves them local', async () => {
  const renderer = await renderApp();
  createBuyInSession(100, 150);
  createBuyInSession(50, 20);
  await signIn(renderer, 'A');
  expect(latestApi.sessionHistory.every((s) => s.syncedUserId === 'A')).toBe(true);

  // What ProfileScreen does after deleteAccount() resolves: sign-out first
  // (the RPC already removed the server rows), then hand the local copies back.
  await signIn(renderer, null);
  pushSessions.mockClear();
  act(() => {
    latestApi.releaseAccountSessions('A');
  });
  await flush();

  expect(latestApi.sessionHistory).toHaveLength(2);
  expect(latestApi.sessionHistory.every((s) => s.syncedUserId === undefined)).toBe(true);
  // Signed out, so nothing should have been pushed back to the dead account.
  expect(pushSessions).not.toHaveBeenCalled();
});

test('releasing one account\'s sessions leaves another account\'s sessions tagged', async () => {
  const renderer = await renderApp();
  createBuyInSession(100, 150);
  await signIn(renderer, 'A');
  await signIn(renderer, null);
  createBuyInSession(75, 25);
  await signIn(renderer, 'B');
  await signIn(renderer, null);

  act(() => {
    latestApi.releaseAccountSessions('A');
  });
  await flush();

  const owners = latestApi.sessionHistory.map((s) => s.syncedUserId);
  expect(owners).toContain('B');
  expect(owners).not.toContain('A');
});

// --- Deletes stick, and a foreground sync only sends what changed ---

function pushedIds() {
  return pushSessions.mock.calls.flatMap(([, sessions]) => sessions.map((s) => s.id));
}

async function signInWithTwoSyncedSessions() {
  const renderer = await renderApp();
  createBuyInSession(100, 150);
  createBuyInSession(50, 20);
  await signIn(renderer, 'A');
  const [first, second] = latestApi.sessionHistory;
  expect(first.syncedUserId).toBe('A');
  expect(second.syncedUserId).toBe('A');
  // From here on the cloud holds both, as it would after that push.
  pullSessions.mockResolvedValue({ sessions: [first, second], error: null });
  pushSessions.mockClear();
  return { renderer, first, second };
}

test('a foreground sync does not re-push sessions the cloud already has', async () => {
  await signInWithTwoSyncedSessions();

  await foreground();

  expect(pullSessions).toHaveBeenCalled();
  expect(pushedIds()).toEqual([]);
  expect(latestApi.sessionHistory).toHaveLength(2);
});

test('a session deleted on another device is dropped here, not pushed back', async () => {
  const { first, second } = await signInWithTwoSyncedSessions();
  // Another device deleted `second`; the cloud now only has `first`.
  pullSessions.mockResolvedValue({ sessions: [first], error: null });

  await foreground();

  expect(pushedIds()).not.toContain(second.id);
  expect(latestApi.sessionHistory.map((s) => s.id)).toEqual([first.id]);
});

test('an empty cloud is not read as "delete everything here"', async () => {
  await signInWithTwoSyncedSessions();
  pullSessions.mockResolvedValue({ sessions: [], error: null });

  await foreground();

  // Kept locally (this may be the only copy left), and not pushed back either.
  expect(latestApi.sessionHistory).toHaveLength(2);
  expect(pushedIds()).toEqual([]);
});

test('a failed pull neither drops synced sessions nor re-pushes them', async () => {
  await signInWithTwoSyncedSessions();
  pullSessions.mockResolvedValue({ sessions: [], error: { message: 'offline' } });

  await foreground();

  expect(latestApi.sessionHistory).toHaveLength(2);
  expect(pushedIds()).toEqual([]);
});

test('a star toggled locally is pushed on the next sync', async () => {
  const { first } = await signInWithTwoSyncedSessions();
  // Write-through push fails (offline), so only reconciliation can carry it.
  pushSessions.mockResolvedValue({ error: { message: 'offline' } });
  act(() => {
    latestApi.toggleSessionStar(first.id);
  });
  await flush();
  pushSessions.mockClear();
  pushSessions.mockResolvedValue({ error: null });

  await foreground();

  expect(pushedIds()).toEqual([first.id]);
});

test('a session deleted while offline is not pulled back in, and its delete is retried', async () => {
  const { first, second } = await signInWithTwoSyncedSessions();
  deleteCloudSessions.mockResolvedValue({ error: { message: 'offline' } });

  act(() => {
    latestApi.deleteSession(second.id);
  });
  await flush();

  expect(addPendingCloudDeletes).toHaveBeenCalledWith('A', [second.id]);
  expect(removePendingCloudDeletes).not.toHaveBeenCalled();

  // Still offline, and the cloud still has it: the pull must not restore it.
  loadPendingCloudDeletes.mockResolvedValue([second.id]);
  await foreground();
  expect(latestApi.sessionHistory.map((s) => s.id)).toEqual([first.id]);
  expect(pushedIds()).not.toContain(second.id);

  // Back online: the retried delete lands and the pending record is cleared.
  deleteCloudSessions.mockResolvedValue({ error: null });
  deleteCloudSessions.mockClear();
  await foreground();
  expect(deleteCloudSessions).toHaveBeenCalledWith('A', [second.id]);
  expect(removePendingCloudDeletes).toHaveBeenCalledWith('A', [second.id]);
  expect(latestApi.sessionHistory.map((s) => s.id)).toEqual([first.id]);
});

// --- Unreadable history is never overwritten ---

test('history that fails to load is not overwritten by later saves', async () => {
  loadSessionHistory.mockResolvedValue(null);

  await renderApp();
  createBuyInSession(100, 150);
  await flush();

  // Retried once before giving up.
  expect(loadSessionHistory).toHaveBeenCalledTimes(2);
  expect(saveSessionHistory).not.toHaveBeenCalled();
  // The session is still usable in memory for this run.
  expect(latestApi.sessionHistory).toHaveLength(1);
});

test('history that loads on the retry is saved normally', async () => {
  loadSessionHistory.mockResolvedValueOnce(null).mockResolvedValueOnce([]);

  await renderApp();
  createBuyInSession(100, 150);
  await flush();

  expect(saveSessionHistory).toHaveBeenCalled();
});

test('erasing all data re-enables saving over an unreadable history', async () => {
  loadSessionHistory.mockResolvedValue(null);

  await renderApp();
  act(() => {
    latestApi.clearAllSessions();
  });
  await flush();

  expect(saveSessionHistory).toHaveBeenLastCalledWith([]);
});

// --- Ending a session is written through immediately ---

test('ending a session removes it from storage at once, not after the debounce', async () => {
  const { saveActiveSessions } = require('../../services/storageService');
  await renderApp();
  act(() => {
    latestApi.startSession('Poker');
  });
  act(() => {
    latestApi.setSessionBuyInCashOut('Poker', 100, null);
  });
  // Let the debounced write persist the live session first.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(600);
  });
  expect(saveActiveSessions).toHaveBeenLastCalledWith(
    expect.objectContaining({ Poker: expect.objectContaining({ buyIn: 100 }) })
  );
  saveActiveSessions.mockClear();

  act(() => {
    latestApi.endActiveSession('Poker', 100, 150);
  });

  // Synchronously, with no timers advanced: a kill now can't resurrect it.
  expect(saveActiveSessions).toHaveBeenCalledWith({});
  expect(latestApi.sessionHistory).toHaveLength(1);
});
