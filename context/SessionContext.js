import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  loadSessionHistory,
  saveSessionHistory,
} from '../services/storageService';

const SessionContext = createContext();

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

  const startSession = (gameType = 'Blackjack') => {
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
  };

  const logHandToActiveSession = (handRecord) => {
    if (!activeSession) return;
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        hands: [handRecord, ...prev.hands],
      };
    });
  };

  const removeHandFromActiveSession = (handId) => {
    if (!activeSession) return;
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        hands: prev.hands.filter((h) => h.id !== handId),
      };
    });
  };

  const setSessionBuyInCashOut = (buyIn, cashOut) => {
    if (!activeSession) return;
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        buyIn,
        cashOut,
      };
    });
  };

  const updateActiveSessionMetadata = (metadata) => {
    if (!activeSession) return;
    setActiveSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ...metadata,
      };
    });
  };

  const endActiveSession = (overrideBuyIn = null, overrideCashOut = null) => {
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
  };

  const discardActiveSession = () => {
    setActiveSession(null);
  };

  const deleteSession = (sessionId) => {
    setSessionHistory((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const clearAllSessions = () => {
    setActiveSession(null);
    setSessionHistory([]);
  };

  return (
    <SessionContext.Provider
      value={{
        activeSession,
        sessionHistory,
        isLoaded,
        startSession,
        updateActiveSessionMetadata,
        logHandToActiveSession,
        removeHandFromActiveSession,
        setSessionBuyInCashOut,
        endActiveSession,
        discardActiveSession,
        deleteSession,
        clearAllSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}