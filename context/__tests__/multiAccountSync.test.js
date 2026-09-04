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
  loadActiveSession: jest.fn(async () => null),
  saveActiveSession: jest.fn(async () => true),
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
const { pushSessions, pullSessions } = require('../../services/syncService');
const { loadSessionHistory, loadActiveSession } = require('../../services/storageService');

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

async function renderApp() {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <SessionProvider>
        <Harness />
      </SessionProvider>
    );
  });
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
  loadActiveSession.mockResolvedValue(null);
  pushSessions.mockResolvedValue({ error: null });
  pullSessions.mockResolvedValue({ sessions: [], error: null });
  useAuth.mockReturnValue({ user: null });
  latestApi = null;
});

afterEach(() => {
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
