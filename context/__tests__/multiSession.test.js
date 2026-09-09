// Exercises the real SessionContext for concurrent sessions: one live
// session per game type, running side by side, each ended independently.
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
}));

const { SessionProvider, useSessionHistory, useActiveSession } = require('../SessionContext');
const { saveActiveSessions, loadActiveSessions } = require('../../services/storageService');

let api = null;

function Harness() {
  const history = useSessionHistory();
  const active = useActiveSession();
  api = { ...history, ...active };
  return null;
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
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
  api = null;
});

test('a session can run for each game type at the same time', async () => {
  await renderApp();

  act(() => {
    api.startSession('Blackjack');
    api.startSession('Poker');
    api.startSession('Sports Betting');
  });

  expect(api.activeSessionCount).toBe(3);
  expect(Object.keys(api.activeSessions).sort()).toEqual(['Blackjack', 'Poker', 'Sports Betting']);
});

test('starting a game that is already running is a no-op, not a restart', async () => {
  await renderApp();

  act(() => api.startSession('Poker'));
  const firstId = api.activeSessions.Poker.id;

  act(() => api.startSession('Poker'));

  expect(api.activeSessionCount).toBe(1);
  // Same session — the tracker screens call startSession on every mount, so
  // returning to one must never wipe what's been logged.
  expect(api.activeSessions.Poker.id).toBe(firstId);
});

test('hands are logged against the named game only', async () => {
  await renderApp();

  act(() => {
    api.startSession('Blackjack');
    api.startSession('Poker');
  });
  act(() => {
    api.logHandToActiveSession('Blackjack', { id: 'h1', outcome: 'win', netChange: 25 });
    api.logHandToActiveSession('Poker', { id: 'h2', outcome: 'loss', netChange: -10 });
    api.logHandToActiveSession('Poker', { id: 'h3', outcome: 'win', netChange: 40 });
  });

  expect(api.activeSessions.Blackjack.hands).toHaveLength(1);
  expect(api.activeSessions.Poker.hands).toHaveLength(2);
});

test('ending one game leaves the others running', async () => {
  await renderApp();

  act(() => {
    api.startSession('Blackjack');
    api.startSession('Poker');
  });
  act(() => {
    api.logHandToActiveSession('Blackjack', { id: 'h1', outcome: 'win', netChange: 25 });
    api.logHandToActiveSession('Poker', { id: 'h2', outcome: 'loss', netChange: -10 });
  });
  act(() => api.endActiveSession('Blackjack'));

  expect(api.activeSessionCount).toBe(1);
  expect(api.activeSessions.Poker).toBeTruthy();
  expect(api.sessionHistory).toHaveLength(1);
  expect(api.sessionHistory[0].gameType).toBe('Blackjack');
  expect(api.sessionHistory[0].netProfit).toBe(25);
});

test('ending an untouched game discards it rather than filing a $0 record', async () => {
  await renderApp();

  act(() => api.startSession('General'));
  act(() => api.endActiveSession('General'));

  expect(api.activeSessionCount).toBe(0);
  expect(api.sessionHistory).toHaveLength(0);
});

test('a buy-in game ends on its override amounts', async () => {
  await renderApp();

  act(() => api.startSession('General'));
  act(() => api.endActiveSession('General', 100, 175));

  expect(api.sessionHistory).toHaveLength(1);
  expect(api.sessionHistory[0].netProfit).toBe(75);
  expect(api.sessionHistory[0].mode).toBe('buyInCashOut');
});

test('live sessions are persisted so a restart cannot destroy them', async () => {
  jest.useFakeTimers();
  try {
    await renderApp();

    act(() => {
      api.startSession('Blackjack');
      api.startSession('Poker');
    });
    act(() => api.logHandToActiveSession('Blackjack', { id: 'h1', outcome: 'win', netChange: 25 }));

    expect(loadActiveSessions).toHaveBeenCalled();
    // Debounced — nothing is written until the burst of updates settles.
    expect(saveActiveSessions).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(500));

    const persisted = saveActiveSessions.mock.calls.at(-1)[0];
    expect(Object.keys(persisted)).toEqual(['Blackjack']); // Poker has nothing in it yet
    expect(persisted.Blackjack.hands).toHaveLength(1);
    expect(persisted.Blackjack.lastActiveAt).toEqual(expect.any(Number));
  } finally {
    jest.useRealTimers();
  }
});

test('a persisted session is restored on the next launch', async () => {
  loadActiveSessions.mockResolvedValueOnce({
    Blackjack: {
      id: '00000000-0000-4000-8000-00000000dead',
      gameType: 'Blackjack',
      startTime: Date.now() - 60 * 60 * 1000,
      lastActiveAt: Date.now() - 60 * 1000,
      hands: [{ id: 'h1', outcome: 'loss', netChange: -50 }],
      buyIn: null,
      cashOut: null,
    },
  });

  await renderApp();

  expect(api.activeSessionCount).toBe(1);
  expect(api.activeSessions.Blackjack.hands).toHaveLength(1);
  // Recent enough that it resumes without asking.
  expect(api.staleSessions).toHaveLength(0);
});

test('an empty session is not restored, so no phantom session comes back', async () => {
  loadActiveSessions.mockResolvedValueOnce({
    Poker: {
      id: '00000000-0000-4000-8000-0000000000aa',
      gameType: 'Poker',
      startTime: Date.now() - 1000,
      lastActiveAt: Date.now() - 500,
      hands: [],
      buyIn: null,
      cashOut: null,
    },
  });

  await renderApp();

  expect(api.activeSessionCount).toBe(0);
});

test('a General session keeps a buy-in that has no cash-out yet', async () => {
  // Looser than sessionHasContent on purpose: there is nothing to finalize,
  // but the figure the user typed still has to survive the restart.
  loadActiveSessions.mockResolvedValueOnce({
    General: {
      id: '00000000-0000-4000-8000-0000000000bb',
      gameType: 'General',
      startTime: Date.now() - 1000,
      lastActiveAt: Date.now() - 500,
      hands: [],
      buyIn: 200,
      cashOut: null,
    },
  });

  await renderApp();

  expect(api.activeSessions.General.buyIn).toBe(200);
});

test('a session the app was dead through comes back flagged rather than silently resumed', async () => {
  const NINE_HOURS = 9 * 60 * 60 * 1000;
  const lastActiveAt = Date.now() - NINE_HOURS;

  loadActiveSessions.mockResolvedValueOnce({
    Blackjack: {
      id: '00000000-0000-4000-8000-0000000000cc',
      gameType: 'Blackjack',
      startTime: lastActiveAt - 60 * 60 * 1000,
      lastActiveAt,
      hands: [{ id: 'h1', outcome: 'loss', netChange: -50 }],
      buyIn: null,
      cashOut: null,
    },
  });

  await renderApp();

  expect(api.staleSessions).toHaveLength(1);
  expect(api.staleSessions[0].staleSince).toBe(lastActiveAt);

  // Closing it out records it as having ended when the app died, not now.
  let record;
  act(() => {
    record = api.closeOutStaleSession('Blackjack');
  });
  expect(record.endTime).toBe(lastActiveAt);
  expect(record.durationFormatted).toBe('1h');
  expect(api.activeSessionCount).toBe(0);
});

test('resuming a stale session discounts the hours the app was closed', async () => {
  const NINE_HOURS = 9 * 60 * 60 * 1000;
  const startTime = Date.now() - NINE_HOURS - 30 * 60 * 1000;
  const lastActiveAt = startTime + 30 * 60 * 1000; // played 30m, then the app died

  loadActiveSessions.mockResolvedValueOnce({
    Blackjack: {
      id: '00000000-0000-4000-8000-0000000000dd',
      gameType: 'Blackjack',
      startTime,
      lastActiveAt,
      hands: [{ id: 'h1', outcome: 'win', netChange: 25 }],
      buyIn: null,
      cashOut: null,
    },
  });

  await renderApp();
  expect(api.staleSessions).toHaveLength(1);

  act(() => api.resumeStaleSession('Blackjack'));
  expect(api.staleSessions).toHaveLength(0);

  let record;
  act(() => {
    record = api.endActiveSession('Blackjack');
  });
  // ~8h of the wall-clock span was the app being shut, so it must not be
  // counted as time played — session length feeds the fatigue insights.
  expect(record.durationFormatted).toBe('30m');
});

test('a stale session persisted again keeps the moment it was last really alive', async () => {
  // Otherwise the first write-through after launch would stamp lastActiveAt to
  // now, and dying again before the user answers would resurrect the session
  // as if it had been active all along.
  jest.useFakeTimers();
  try {
    const lastActiveAt = Date.now() - 9 * 60 * 60 * 1000;
    loadActiveSessions.mockResolvedValueOnce({
      Blackjack: {
        id: '00000000-0000-4000-8000-0000000000ff',
        gameType: 'Blackjack',
        startTime: lastActiveAt - 60 * 60 * 1000,
        lastActiveAt,
        hands: [{ id: 'h1', outcome: 'loss', netChange: -50 }],
        buyIn: null,
        cashOut: null,
      },
    });

    await renderApp();
    act(() => jest.advanceTimersByTime(500));

    const persisted = saveActiveSessions.mock.calls.at(-1)[0];
    expect(persisted.Blackjack.lastActiveAt).toBe(lastActiveAt);
    expect(persisted.Blackjack).not.toHaveProperty('staleSince');
  } finally {
    jest.useRealTimers();
  }
});

test('a malformed cloud row is dropped instead of reaching the screens', async () => {
  await renderApp();

  act(() =>
    api.mergeSessionsFromCloud([
      { id: 'good', gameType: 'Poker', startTime: 1700000000000, hands: [], netProfit: 10 },
      { id: 'no-start-time', gameType: 'Poker', hands: [] },
      { gameType: 'Poker', startTime: 1700000000001, hands: [] },
      null,
    ])
  );

  expect(api.sessionHistory.map((s) => s.id)).toEqual(['good']);
});

test('a cloud row missing its hands array is kept, with hands normalized', async () => {
  await renderApp();

  act(() =>
    api.mergeSessionsFromCloud([
      { id: 'legacy', gameType: 'Blackjack', startTime: 1700000000000, netProfit: -20 },
    ])
  );

  expect(api.sessionHistory).toHaveLength(1);
  expect(api.sessionHistory[0].hands).toEqual([]);
});

test('a sports session sits open for days without being flagged', async () => {
  // A slip waiting on results is the normal case there, not a suspicious one.
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  loadActiveSessions.mockResolvedValueOnce({
    'Sports Betting': {
      id: '00000000-0000-4000-8000-0000000000ee',
      gameType: 'Sports Betting',
      startTime: Date.now() - THREE_DAYS,
      lastActiveAt: Date.now() - THREE_DAYS,
      hands: [{ id: 'b1', outcome: 'pending', netChange: 0 }],
      buyIn: null,
      cashOut: null,
    },
  });

  await renderApp();

  expect(api.activeSessionCount).toBe(1);
  expect(api.staleSessions).toHaveLength(0);
});
