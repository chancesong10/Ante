import React, { createContext, useContext, useState } from 'react';

const SessionContext = createContext();

// Helper to format date with explicit relative formatting
export function formatSessionDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();

  // Strip time for day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((today - targetDay) / oneDay);

  // Format time (e.g. 3:45 PM)
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
    // MM/DD/YYYY at h:mm A
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year} at ${timeStr}`;
  }
}

// Helper to format duration between two timestamps
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
  // activeSession: null or { id, gameType, startTime, hands: [] }
  const [activeSession, setActiveSession] = useState(null);

  // sessionHistory: Array of completed sessions (starts completely empty)
  const [sessionHistory, setSessionHistory] = useState([]);

  // Start a new session
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

  // Log a hand into the active session
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

  // End and finalize the active session
  const endActiveSession = () => {
  if (!activeSession) return null;

  const endTime = Date.now();
  const startTime = activeSession.startTime;
  const isBuyInMode = activeSession.buyIn !== null && activeSession.cashOut !== null;

  let completedRecord;

  if (isBuyInMode) {
    const netProfit = activeSession.cashOut - activeSession.buyIn;

    completedRecord = {
      id: activeSession.id,
      gameType: activeSession.gameType,
      startTime,
      endTime,
      formattedDate: formatSessionDateTime(startTime),
      rawDate: new Date(startTime).toISOString(),
      durationFormatted: formatDuration(startTime, endTime),
      mode: 'buyInCashOut',
      buyIn: activeSession.buyIn,
      cashOut: activeSession.cashOut,
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
    const losses = allHands.filter((h) => h.outcome === 'loss').length;
    const pushes = allHands.filter((h) => h.outcome === 'push').length;
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
      netProfit,
      grossWins,
      grossLosses,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
    };
  }

  setSessionHistory((prev) => [completedRecord, ...prev]);
  setActiveSession(null);
  return completedRecord;
};

  // Discard current active session without saving
  const discardActiveSession = () => {
    setActiveSession(null);
  };

  // Delete a session from history
  const deleteSession = (sessionId) => {
    setSessionHistory((prev) => prev.filter((s) => s.id !== sessionId));
  };

  return (
    <SessionContext.Provider
      value={{
        activeSession,
        sessionHistory,
        startSession,
        logHandToActiveSession,
        removeHandFromActiveSession,
        setSessionBuyInCashOut, // add this line
        endActiveSession,
        discardActiveSession,
        deleteSession,
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
