import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  loadSessionHistory,
  saveSessionHistory,
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

export function SessionProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedOnce = useRef(false);

  // Mirrors activeSession so action callbacks below can read the latest
  // value without listing it as a dependency — keeps their identities
  // stable across every hand logged, so components/contexts memoized on
  // these functions (or on the provider's value object) don't get
  // invalidated on the app's hottest update path.
  const activeSessionRef = useRef(activeSession);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Load persisted history once on app start.
  // Note: activeSession is intentionally NOT persisted — an in-progress
  // session left mid-entry is safer to discard on force-close than to
  // silently resume in a possibly-stale state.
  useEffect(() => {
    if (hasLoadedOnce.current) return;
    hasLoadedOnce.current = true;

    (async () => {
      const stored = await loadSessionHistory();
      setSessionHistory(stored);
      setIsLoaded(true);
    })();
  }, []);

  // Persist sessionHistory to storage any time it changes, after initial load completes.
  useEffect(() => {
    if (!isLoaded) return;
    saveSessionHistory(sessionHistory);
  }, [sessionHistory, isLoaded]);

  const startSession = useCallback((gameType = 'Blackjack') => {
    const newSession = {
      id: Date.now().toString(),
      gameType,
      startTime: Date.now(),
      hands: [],
      buyIn: null,
      cashOut: null,
    };
    setActiveSession(newSession);
    return newSession;
  }, []);

  const logHandToActiveSession = useCallback((handRecord) => {
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        hands: [handRecord, ...prev.hands],
      };
    });
  }, []);

  const removeHandFromActiveSession = useCallback((handId) => {
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        hands: prev.hands.filter((h) => h.id !== handId),
      };
    });
  }, []);

  const setSessionBuyInCashOut = useCallback((buyIn, cashOut) => {
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        buyIn,
        cashOut,
      };
    });
  }, []);

  const updateActiveSessionMetadata = useCallback((metadata) => {
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ...metadata,
      };
    });
  }, []);

  const endActiveSession = useCallback((overrideBuyIn = null, overrideCashOut = null) => {
    const activeSession = activeSessionRef.current;
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

    setSessionHistory((prev) => [completedRecord, ...prev]);
    setActiveSession(null);
    return completedRecord;
  }, []);

  const discardActiveSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  const deleteSession = useCallback((sessionId) => {
    setSessionHistory((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const clearAllSessions = useCallback(() => {
    setActiveSession(null);
    setSessionHistory([]);
  }, []);

  // Each recomputed only when its own underlying data actually changes, so
  // a screen subscribed to just one of the two contexts doesn't re-render
  // when the other one updates.
  const activeSessionValue = useMemo(
    () => ({
      activeSession,
      startSession,
      updateActiveSessionMetadata,
      logHandToActiveSession,
      removeHandFromActiveSession,
      setSessionBuyInCashOut,
      endActiveSession,
      discardActiveSession,
    }),
    [
      activeSession,
      startSession,
      updateActiveSessionMetadata,
      logHandToActiveSession,
      removeHandFromActiveSession,
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
    }),
    [sessionHistory, isLoaded, deleteSession, clearAllSessions]
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

export function useSessionHistory() {
  const context = useContext(SessionHistoryContext);
  if (!context) {
    throw new Error('useSessionHistory must be used within a SessionProvider');
  }
  return context;
}