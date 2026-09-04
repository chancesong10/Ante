import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import {
  loadSessionHistory,
  saveSessionHistory,
  loadActiveSession,
  saveActiveSession,
} from '../services/storageService';

// Split into two contexts by update frequency:
// - ActiveSessionContext changes on every hand/bet logged during live play
//   (hot path — screens like PokerScreen call an update per action).
// - SessionHistoryContext changes only when a session starts/ends/is
//   deleted (cold path — Analytics/History/Profile/Insights screens only
//   ever read completed history).
// Keeping them separate means a screen that only cares about history
// (e.g. Analytics, kept mounted in the background by the bottom tab bar)
// doesn't re-render on every hand of an in-progress session elsewhere in
// the app. Both are still owned and updated from one SessionProvider
// below, since a couple of actions (ending a session, clearing all data)
// legitimately need to touch both pieces of state at once.
const ActiveSessionContext = createContext();
const SessionHistoryContext = createContext();

export function formatSessionDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((today - targetDay) / oneDay);

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  } else {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year} at ${timeStr}`;
  }
}

export function formatDuration(startTime, endTime) {
  if (!startTime || !endTime) return '< 1m';
  const diffMs = Math.max(0, endTime - startTime);
  const diffSec = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSec / 60);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) {
    return '< 1m';
  } else if (hours < 1) {
    return `${minutes}m`;
  } else {
    const remMins = minutes % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  }
}

export function finalizeSession(activeSession, overrideBuyIn = null, overrideCashOut = null) {
  if (!activeSession) return null;

  const endTime = Date.now();
  const startTime = activeSession.startTime;

  const finalBuyIn = overrideBuyIn !== null ? overrideBuyIn : activeSession.buyIn;
  const finalCashOut = overrideCashOut !== null ? overrideCashOut : activeSession.cashOut;
  const isBuyInMode = finalBuyIn !== null && finalCashOut !== null;

  let completedRecord;

  if (isBuyInMode) {
    const netProfit = finalCashOut - finalBuyIn;

    completedRecord = {
      id: activeSession.id,
      gameType: activeSession.gameType,
      startTime,
      endTime,
      formattedDate: formatSessionDateTime(startTime),
      rawDate: new Date(startTime).toISOString(),
      durationFormatted: formatDuration(startTime, endTime),
      mode: 'buyInCashOut',
      buyIn: finalBuyIn,
      cashOut: finalCashOut,
      hands: [],
      totalHands: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      netProfit,
      grossWins: netProfit > 0 ? netProfit : 0,
      grossLosses: netProfit < 0 ? Math.abs(netProfit) : 0,
      winRate: netProfit > 0 ? 100 : 0,
    };
  } else {
    const hands = activeSession.hands;
    const allHands = hands.flatMap((r) => (r.type === 'split' ? r.hands : [r]));
    const totalHands = allHands.length;
    const wins = allHands.filter((h) => h.outcome === 'win').length;
    const losses = allHands.filter((h) => h.outcome === 'loss' || h.outcome === 'fold').length;
    const pushes = allHands.filter((h) => h.outcome === 'push' || h.outcome === 'split').length;
    const folds = allHands.filter((h) => h.outcome === 'fold').length;
    const bluffedFolds = allHands.filter((h) => h.outcome === 'fold' && h.foldReason === 'bluffed').length;
    const goodFolds = allHands.filter((h) => h.outcome === 'fold' && h.foldReason === 'good_fold').length;
    const netProfit = allHands.reduce((sum, h) => sum + (h.netChange || 0), 0);

    let grossWins = 0;
    let grossLosses = 0;
    allHands.forEach((h) => {
      if (h.netChange > 0) grossWins += h.netChange;
      if (h.netChange < 0) grossLosses += Math.abs(h.netChange);
    });

    completedRecord = {
      id: activeSession.id,
      gameType: activeSession.gameType,
      startTime,
      endTime,
      formattedDate: formatSessionDateTime(startTime),
      rawDate: new Date(startTime).toISOString(),
      durationFormatted: formatDuration(startTime, endTime),
      mode: 'hands',
      hands,
      totalHands,
      wins,
      losses,
      pushes,
      folds,
      bluffedFolds,
      goodFolds,
      netProfit,
      grossWins,
      grossLosses,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
      smallBlind: activeSession.smallBlind,
      bigBlind: activeSession.bigBlind,
      chipDenominations: activeSession.chipDenominations,
    };
  }
  return completedRecord;
}

// True if a live session has anything worth keeping — at least one logged
// hand, or a completed (finite) buy-in/cash-out pair. An untouched session
// (tracker opened, nothing entered) has neither, and finalizing it would
// leave a phantom $0 / 0-hand row in History. `NaN`/`Infinity` buy-in or
// cash-out counts as "no content" too, so a half-entered amount can't slip
// a broken record through.
export function sessionHasContent(session, overrideBuyIn = null, overrideCashOut = null) {
  if (!session) return false;
  const hands = Array.isArray(session.hands) ? session.hands : [];
  if (hands.length > 0) return true;
  const buyIn = overrideBuyIn !== null ? overrideBuyIn : session.buyIn;
  const cashOut = overrideCashOut !== null ? overrideCashOut : session.cashOut;
  return Number.isFinite(buyIn) && Number.isFinite(cashOut);
}

export function SessionProvider({ children }) {
  // Live sessions, keyed by game type — at most one per game, so Blackjack,
  // Poker, Sports Betting and General can all be running at once. Keying by
  // game rather than by id is what lets each tracker screen keep owning "its"
  // session without having to be handed an id through navigation.
  const [activeSessions, setActiveSessions] = useState({});
  const [sessionHistory, setSessionHistory] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Mirrors activeSessions so action callbacks below can read the latest
  // value without listing it as a dependency — keeps their identities
  // stable across every hand logged, so components/contexts memoized on
  // these functions (or on the provider's value object) don't get
  // invalidated on the app's hottest update path.
  const activeSessionsRef = useRef(activeSessions);
  useEffect(() => {
    activeSessionsRef.current = activeSessions;
  }, [activeSessions]);

  // Load persisted history once on app start.
  //
  // Live sessions are deliberately NOT persisted: closing the app ends them.
  // Worth knowing that on the next launch the OS can't tell a deliberate
  // force-quit from a low-memory kill, so a backgrounded session can be lost
  // the same way. Re-enabling recovery means restoring a write here and
  // finalising whatever `sessionHasContent` approves on the way back in.
  useEffect(() => {
    if (hasLoadedOnce.current) return;
    hasLoadedOnce.current = true;

    (async () => {
      const storedHistory = await loadSessionHistory();
      // Clears anything a previous build left behind under the old key.
      await saveActiveSession(null);
      setSessionHistory(storedHistory);
      setIsLoaded(true);
    })();
  }, []);

  // Persist sessionHistory to storage any time it changes, after initial load completes.
  useEffect(() => {
    if (!isLoaded) return;
    saveSessionHistory(sessionHistory);
  }, [sessionHistory, isLoaded]);

  // Applies `fn` to one game's live session, leaving the others untouched.
  const patchSession = useCallback((gameType, fn) => {
    setActiveSessions((prev) => {
      const current = prev[gameType];
      if (!current) return prev;
      return { ...prev, [gameType]: fn(current) };
    });
  }, []);

  const dropSession = useCallback((gameType) => {
    setActiveSessions((prev) => {
      if (!prev[gameType]) return prev;
      const next = { ...prev };
      delete next[gameType];
      return next;
    });
  }, []);

  const startSession = useCallback((gameType = 'Blackjack') => {
    const newSession = {
      id: Crypto.randomUUID(),
      gameType,
      startTime: Date.now(),
      hands: [],
      buyIn: null,
      cashOut: null,
    };
    // Never clobber a session already running for this game — the tracker
    // screens call this on mount, so returning to one has to be a no-op.
    setActiveSessions((prev) => (prev[gameType] ? prev : { ...prev, [gameType]: newSession }));
    return newSession;
  }, []);

  const logHandToActiveSession = useCallback(
    (gameType, handRecord) =>
      patchSession(gameType, (s) => ({ ...s, hands: [handRecord, ...s.hands] })),
    [patchSession]
  );

  const removeHandFromActiveSession = useCallback(
    (gameType, handId) =>
      patchSession(gameType, (s) => ({ ...s, hands: s.hands.filter((h) => h.id !== handId) })),
    [patchSession]
  );

  const updateHandInActiveSession = useCallback(
    (gameType, handId, updates) =>
      patchSession(gameType, (s) => ({
        ...s,
        hands: s.hands.map((h) => (h.id === handId ? { ...h, ...updates } : h)),
      })),
    [patchSession]
  );

  const setSessionBuyInCashOut = useCallback(
    (gameType, buyIn, cashOut) => patchSession(gameType, (s) => ({ ...s, buyIn, cashOut })),
    [patchSession]
  );

  const updateActiveSessionMetadata = useCallback(
    (gameType, metadata) => patchSession(gameType, (s) => ({ ...s, ...metadata })),
    [patchSession]
  );

  const endActiveSession = useCallback(
    (gameType, overrideBuyIn = null, overrideCashOut = null) => {
      const session = activeSessionsRef.current[gameType];
      if (!session) return null;

      // Nothing logged and no completed buy-in/cash-out — drop the session
      // instead of saving a phantom $0 / 0-hand record. The per-game screens
      // already guard this on their "End Session" buttons; this covers the
      // other callers (Home, the start-session sheet, the stop-loss alert).
      if (!sessionHasContent(session, overrideBuyIn, overrideCashOut)) {
        dropSession(gameType);
        return null;
      }

      const completedRecord = finalizeSession(session, overrideBuyIn, overrideCashOut);
      setSessionHistory((prev) => [completedRecord, ...prev]);
      dropSession(gameType);
      return completedRecord;
    },
    [dropSession]
  );

  const discardActiveSession = useCallback((gameType) => dropSession(gameType), [dropSession]);

  const deleteSession = useCallback((sessionId) => {
    setSessionHistory((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const clearAllSessions = useCallback(() => {
    setActiveSessions({});
    setSessionHistory([]);
  }, []);

  // Unions cloud sessions pulled for the current account into local history,
  // deduped by id (the same client-generated UUID on both sides). Existing
  // local records win on conflict since they're the more recently-touched
  // copy; sessions are immutable once completed so this is a plain union,
  // never a field-level merge.
  const mergeSessionsFromCloud = useCallback((cloudSessions) => {
    if (!cloudSessions?.length) return;
    setSessionHistory((prev) => {
      const knownIds = new Set(prev.map((s) => s.id));
      const additions = cloudSessions.filter((s) => !knownIds.has(s.id));
      if (!additions.length) return prev;
      return [...prev, ...additions].sort((a, b) => b.startTime - a.startTime);
    });
  }, []);

  // Stamps synced sessions with the account they now belong to, so a later
  // login from a *different* account on this device knows not to re-push
  // (or re-attribute) sessions that already belong to someone else.
  const markSessionsSynced = useCallback((sessionIds, userId) => {
    if (!sessionIds?.length) return;
    const idSet = new Set(sessionIds);
    setSessionHistory((prev) =>
      prev.map((s) => (idSet.has(s.id) ? { ...s, syncedUserId: userId } : s))
    );
  }, []);

  // Each recomputed only when its own underlying data actually changes, so
  // a screen subscribed to just one of the two contexts doesn't re-render
  // when the other one updates.
  // Newest first, so lists read the same way History does.
  const activeSessionList = useMemo(
    () => Object.values(activeSessions).sort((a, b) => b.startTime - a.startTime),
    [activeSessions]
  );

  const activeSessionValue = useMemo(
    () => ({
      activeSessions,
      activeSessionList,
      activeSessionCount: activeSessionList.length,
      startSession,
      updateActiveSessionMetadata,
      logHandToActiveSession,
      removeHandFromActiveSession,
      updateHandInActiveSession,
      setSessionBuyInCashOut,
      endActiveSession,
      discardActiveSession,
    }),
    [
      activeSessions,
      activeSessionList,
      startSession,
      updateActiveSessionMetadata,
      logHandToActiveSession,
      removeHandFromActiveSession,
      updateHandInActiveSession,
      setSessionBuyInCashOut,
      endActiveSession,
      discardActiveSession,
    ]
  );

  const sessionHistoryValue = useMemo(
    () => ({
      sessionHistory,
      isLoaded,
      deleteSession,
      clearAllSessions,
      mergeSessionsFromCloud,
      markSessionsSynced,
    }),
    [sessionHistory, isLoaded, deleteSession, clearAllSessions, mergeSessionsFromCloud, markSessionsSynced]
  );

  return (
    <SessionHistoryContext.Provider value={sessionHistoryValue}>
      <ActiveSessionContext.Provider value={activeSessionValue}>
        {children}
      </ActiveSessionContext.Provider>
    </SessionHistoryContext.Provider>
  );
}

export function useActiveSession() {
  const context = useContext(ActiveSessionContext);
  if (!context) {
    throw new Error('useActiveSession must be used within a SessionProvider');
  }
  return context;
}

// One game's slice of the above, with the game type already bound.
//
// Every tracker screen owns exactly one game, so this lets them keep the API
// they had when there was only ever a single live session — `activeSession`
// plus the same action names, none of which take a game type. That's what
// kept going multi-session from rippling through all four screens.
export function useGameSession(gameType) {
  const ctx = useActiveSession();
  return useMemo(
    () => ({
      activeSession: ctx.activeSessions[gameType] ?? null,
      // Accepts and ignores an argument, since callers historically passed
      // their game type in.
      startSession: () => ctx.startSession(gameType),
      updateActiveSessionMetadata: (metadata) =>
        ctx.updateActiveSessionMetadata(gameType, metadata),
      logHandToActiveSession: (hand) => ctx.logHandToActiveSession(gameType, hand),
      removeHandFromActiveSession: (handId) => ctx.removeHandFromActiveSession(gameType, handId),
      updateHandInActiveSession: (handId, updates) =>
        ctx.updateHandInActiveSession(gameType, handId, updates),
      setSessionBuyInCashOut: (buyIn, cashOut) =>
        ctx.setSessionBuyInCashOut(gameType, buyIn, cashOut),
      endActiveSession: (buyIn, cashOut) => ctx.endActiveSession(gameType, buyIn, cashOut),
      discardActiveSession: () => ctx.discardActiveSession(gameType),
    }),
    [ctx, gameType]
  );
}

export function useSessionHistory() {
  const context = useContext(SessionHistoryContext);
  if (!context) {
    throw new Error('useSessionHistory must be used within a SessionProvider');
  }
  return context;
}