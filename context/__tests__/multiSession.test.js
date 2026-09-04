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
  loadActiveSession: jest.fn(async () => null),
  saveActiveSession: jest.fn(async () => true),
}));

const { SessionProvider, useSessionHistory, useActiveSession } = require('../SessionContext');
const { saveActiveSession, loadActiveSession } = require('../../services/storageService');

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

test('live sessions are not persisted — closing the app ends them', async () => {
  await renderApp();

  act(() => {
    api.startSession('Blackjack');
    api.startSession('Poker');
  });
  act(() => api.logHandToActiveSession('Blackjack', { id: 'h1', outcome: 'win', netChange: 25 }));

  // Startup clears the legacy key once; nothing is ever written back.
  expect(loadActiveSession).not.toHaveBeenCalled();
  expect(saveActiveSession).toHaveBeenCalledTimes(1);
  expect(saveActiveSession).toHaveBeenCalledWith(null);
});
