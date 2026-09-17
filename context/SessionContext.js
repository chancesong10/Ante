import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import {
  loadSessionHistory,
  saveSessionHistory,
  loadActiveSessions,
  saveActiveSessions,
  clearLegacyActiveSession,
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

export function finalizeSession(
  activeSession,
  overrideBuyIn = null,
  overrideCashOut = null,
  { endTime: endTimeOverride = null } = {}
) {
  if (!activeSession) return null;

  // `endTimeOverride` exists for one caller: closing out a session the app
  // died on. That session ends at the last moment the app was known to be
  // alive, not at whatever time the user happens to relaunch.
  const endTime = endTimeOverride ?? Date.now();
  const startTime = activeSession.startTime;

  // Time the app spent dead between a session being persisted and the user
  // resuming it isn't time spent at the table. Subtracting it matters beyond
  // display: session length feeds the fatigue and session-length patterns in
  // the insights engines, so an overnight gap left in would read as a
  // marathon session and skew the leak detector.
  const durationFormatted = formatDuration(startTime, endTime - (activeSession.pausedMs || 0));

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
      durationFormatted,
      mode: 'buyInCashOut',
      // What the General tracker was actually tracking ("Craps", "Keno").
      // Undefined for the templated games, which don't ask.
      label: activeSession.label || undefined,
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
      durationFormatted,
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

// The minimum a completed session needs before the app will render it or feed
// it to the stats engines. Applied to everything arriving from outside this
// process — the cloud's `data` column holds whatever some client wrote there,
// possibly a build several versions old — because a single malformed record
// reaching a screen is a render throw, and a render throw on data that is
// *persisted* repeats on every launch.
//
// Missing `hands` is normalized rather than rejected: plenty of screens call
// `.map` on it directly, but a record that's otherwise sound is still the
// user's, and throwing it away to avoid a crash would be its own data loss.
export function sanitizeSessionRecord(session) {
  if (!session || typeof session !== 'object') return null;
  if (typeof session.id !== 'string' || !session.id) return null;
  if (!Number.isFinite(session.startTime)) return null;
  if (typeof session.gameType !== 'string' || !session.gameType) return null;
  return Array.isArray(session.hands) ? session : { ...session, hands: [] };
}

// Worth carrying across a restart. Deliberately looser than
// `sessionHasContent`, which gates what may enter History: a General session
// with a buy-in typed but no cash-out yet has nothing to finalize, but the
// figure the user entered is still theirs and must survive the app dying.
export function sessionWorthRestoring(session) {
  if (!session) return false;
  if (Array.isArray(session.hands) && session.hands.length > 0) return true;
  return Number.isFinite(session.buyIn) || Number.isFinite(session.cashOut);
}

// How long the app may be dead before a restored session is put to the user
// rather than silently resumed. Sports betting is the exception by an order of
// magnitude: a slip legitimately sits open for days waiting on results, so the
// gap that makes a blackjack session suspicious is normal there.
const DEFAULT_STALE_AFTER_MS = 8 * 60 * 60 * 1000;
const STALE_AFTER_MS = { 'Sports Betting': 7 * 24 * 60 * 60 * 1000 };

export function staleThresholdFor(gameType) {
  return STALE_AFTER_MS[gameType] ?? DEFAULT_STALE_AFTER_MS;
}

// Rebuilds the live-session map from what was persisted. Two decisions live
// here rather than at the call site:
//
//   - Anything with nothing in it is dropped, so a tracker that was opened and
//     abandoned doesn't come back as a running session on the next launch.
//   - Anything the app has been dead longer than its game's threshold is
//     restored but marked `staleSince`. Nine hours of downtime almost always
//     means the session ended in real life, and resuming it silently would
//     report a duration counting hours the app wasn't even running. Home puts
//     it to the user instead — the data is kept either way.
export function restoreActiveSessions(stored, now = Date.now()) {
  const restored = {};
  Object.entries(stored || {}).forEach(([gameType, session]) => {
    if (!session || typeof session !== 'object') return;
    if (!session.id || !session.startTime) return;
    if (!sessionWorthRestoring(session)) return;

    // Falling back to startTime covers a blob written before lastActiveAt
    // existed; it can only over-estimate the gap, which errs toward asking.
    const lastActiveAt = session.lastActiveAt || session.startTime;
    const deadFor = Math.max(0, now - lastActiveAt);
    restored[gameType] =
      deadFor > staleThresholdFor(session.gameType || gameType)
        ? { ...session, staleSince: lastActiveAt }
        : session;
  });
  return restored;
}

// Folds the stretch the app spent dead into `pausedMs` and clears the flag.
// Shared by Home's prompt and by simply opening the tracker, because those are
// the same act: the user has decided the session is still going.
export function resumeStale(session, now = Date.now()) {
  if (!session?.staleSince) return session;
  const { staleSince, ...rest } = session;
  return { ...rest, pausedMs: (session.pausedMs || 0) + Math.max(0, now - staleSince) };
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

  // Load persisted history and any live sessions once on app start.
  //
  // Live sessions are restored rather than discarded because the OS can't tell
  // a deliberate force-quit from a low-memory kill, and a bankroll tracker's
  // normal life is sitting backgrounded for hours while its owner is actually
  // playing — so "the app closed" is a terrible proxy for "the session ended".
  // `restoreActiveSessions` decides what comes back and what gets flagged for
  // the user to confirm.
  useEffect(() => {
    if (hasLoadedOnce.current) return;
    hasLoadedOnce.current = true;

    (async () => {
      const [storedHistory, storedActive] = await Promise.all([
        loadSessionHistory(),
        loadActiveSessions(),
      ]);
      // Sweeps anything a pre-multi-session build left under the old key.
      await clearLegacyActiveSession();
      setSessionHistory(storedHistory.map(sanitizeSessionRecord).filter(Boolean));
      setActiveSessions(restoreActiveSessions(storedActive));
      setIsLoaded(true);
    })();
  }, []);

  // Persist sessionHistory to storage any time it changes, after initial load completes.
  useEffect(() => {
    if (!isLoaded) return;
    saveSessionHistory(sessionHistory);
  }, [sessionHistory, isLoaded]);

  // Persist live sessions on every change, debounced.
  //
  // Debouncing matters more here than anywhere else in the app: this is the
  // hottest update path there is — a poker hand fires several updates a second
  // — and an undebounced write would put an AsyncStorage round-trip behind
  // each one, competing with the commit animation on the same JS thread.
  //
  // `lastActiveAt` is stamped at write time rather than held on the session in
  // state, where it would retrigger this effect forever. It records the last
  // moment the app was known to be alive, which is both what the dead gap is
  // measured against on the way back in and what a stale session is finalized
  // at — so a session the app died on is never credited with the hours it
  // spent not running.
  useEffect(() => {
    if (!isLoaded) return undefined;
    const t = setTimeout(() => {
      const now = Date.now();
      const toPersist = {};
      Object.entries(activeSessions).forEach(([gameType, session]) => {
        if (!sessionWorthRestoring(session)) return;
        const { staleSince, ...rest } = session;
        // A session still waiting on the user's answer keeps the timestamp it
        // was last genuinely alive at, so dying a second time before they
        // answer doesn't reset the gap to zero and make it look freshly
        // active. `staleSince` itself is never persisted — it's rederived
        // from `lastActiveAt` on the way back in, which is where the
        // threshold lives.
        toPersist[gameType] = { ...rest, lastActiveAt: staleSince ?? now };
      });
      saveActiveSessions(toPersist);
    }, 500);
    return () => clearTimeout(t);
  }, [activeSessions, isLoaded]);

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
    setActiveSessions((prev) => {
      const current = prev[gameType];
      // Never clobber a session already running for this game — the tracker
      // screens call this on mount, so returning to one has to be a no-op.
      if (!current) return { ...prev, [gameType]: newSession };
      // Opening the tracker on a session the app died on *is* the user
      // resuming it, so discount the gap here too rather than waiting for
      // Home's prompt to be answered.
      const resumed = resumeStale(current);
      return resumed === current ? prev : { ...prev, [gameType]: resumed };
    });
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
    (gameType, overrideBuyIn = null, overrideCashOut = null, options = {}) => {
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

      const completedRecord = finalizeSession(session, overrideBuyIn, overrideCashOut, options);
      setSessionHistory((prev) => [completedRecord, ...prev]);
      dropSession(gameType);
      return completedRecord;
    },
    [dropSession]
  );

  const discardActiveSession = useCallback((gameType) => dropSession(gameType), [dropSession]);

  // --- Restored sessions the app died on ---
  //
  // Both sides of the question Home asks. Resuming folds the dead gap into
  // `pausedMs` so the hours the app wasn't running don't get counted as time
  // played; closing out finalizes at `staleSince`, the last moment the app was
  // known to be alive, rather than at whenever the user happened to relaunch.

  const resumeStaleSession = useCallback(
    (gameType) => patchSession(gameType, (s) => resumeStale(s)),
    [patchSession]
  );

  const closeOutStaleSession = useCallback(
    (gameType) => {
      const session = activeSessionsRef.current[gameType];
      if (!session) return null;
      return endActiveSession(gameType, null, null, { endTime: session.staleSince ?? null });
    },
    [endActiveSession]
  );

  // Stars ride on the session record itself, so they persist and sync with
  // everything else — no separate store to keep in step. `starredAt` isn't
  // shown anywhere; it exists purely so the sync layer can tell a star
  // toggle apart from a session that hasn't changed since it last synced,
  // and so mergeSessionsFromCloud can resolve a star that changed on two
  // devices by last-write-wins instead of just dropping the cloud's copy.
  const toggleSessionStar = useCallback((sessionId) => {
    setSessionHistory((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, starred: !s.starred, starredAt: Date.now() } : s
      )
    );
  }, []);

  const deleteSession = useCallback((sessionId) => {
    setSessionHistory((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const clearAllSessions = useCallback(() => {
    setActiveSessions({});
    setSessionHistory([]);
    // The state change alone would reach storage, but only after the persist
    // effect's 500ms debounce. "Erase everything" is the one action that must
    // not leave a window where the app can be killed and come back with the
    // data still on disk, so write the empty map straight through as well.
    saveActiveSessions({});
  }, []);

  // Unions cloud sessions pulled for the current account into local history,
  // deduped by id (the same client-generated UUID on both sides). Sessions
  // are otherwise immutable once completed, so this stays a plain union for
  // every field but one: `starred` is field-level merged by `starredAt`
  // (last-write-wins), since it's the one thing a session can still change
  // after the fact — and only on the device that changed it, until a pull
  // like this one carries it back in.
  const mergeSessionsFromCloud = useCallback((cloudSessions) => {
    if (!cloudSessions?.length) return;
    // Rows come back as whatever was written into the `data` column, so they
    // are validated before anything downstream is allowed to see them.
    const incoming = cloudSessions.map(sanitizeSessionRecord).filter(Boolean);
    if (!incoming.length) return;
    setSessionHistory((prev) => {
      const localById = new Map(prev.map((s) => [s.id, s]));
      const cloudById = new Map(incoming.map((s) => [s.id, s]));
      const additions = incoming.filter((s) => !localById.has(s.id));

      let starChanged = false;
      const reconciled = prev.map((s) => {
        const cloud = cloudById.get(s.id);
        if (!cloud || (cloud.starredAt || 0) <= (s.starredAt || 0)) return s;
        starChanged = true;
        return { ...s, starred: cloud.starred, starredAt: cloud.starredAt };
      });

      if (!additions.length && !starChanged) return prev;
      return [...reconciled, ...additions].sort((a, b) => b.startTime - a.startTime);
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

  // The inverse of markSessionsSynced: strips the account stamp off sessions
  // that belonged to a now-deleted account, handing them back to the device
  // as plain local records.
  //
  // Without this, deleting an account would orphan its sessions — they'd
  // still be in local storage, but useVisibleSessionHistory hides any session
  // whose syncedUserId isn't the signed-in user, and that id can never come
  // back. Deleting the account deletes what's on the server; it shouldn't
  // silently swallow the copy on the phone.
  const releaseAccountSessions = useCallback((userId) => {
    if (!userId) return;
    setSessionHistory((prev) => {
      if (!prev.some((s) => s.syncedUserId === userId)) return prev;
      return prev.map((s) => {
        if (s.syncedUserId !== userId) return s;
        const { syncedUserId, ...rest } = s;
        return rest;
      });
    });
  }, []);

  // Each recomputed only when its own underlying data actually changes, so
  // a screen subscribed to just one of the two contexts doesn't re-render
  // when the other one updates.
  // Newest first, so lists read the same way History does.
  const activeSessionList = useMemo(
    () => Object.values(activeSessions).sort((a, b) => b.startTime - a.startTime),
    [activeSessions]
  );

  // Restored sessions still awaiting the user's call on whether they're over.
  // They stay in `activeSessions` throughout — they are real sessions with
  // real data — so this is a view onto that list, not a separate store.
  const staleSessions = useMemo(
    () => activeSessionList.filter((s) => s.staleSince),
    [activeSessionList]
  );

  const activeSessionValue = useMemo(
    () => ({
      activeSessions,
      activeSessionList,
      activeSessionCount: activeSessionList.length,
      staleSessions,
      startSession,
      updateActiveSessionMetadata,
      logHandToActiveSession,
      removeHandFromActiveSession,
      updateHandInActiveSession,
      setSessionBuyInCashOut,
      endActiveSession,
      discardActiveSession,
      resumeStaleSession,
      closeOutStaleSession,
    }),
    [
      activeSessions,
      activeSessionList,
      staleSessions,
      startSession,
      updateActiveSessionMetadata,
      logHandToActiveSession,
      removeHandFromActiveSession,
      updateHandInActiveSession,
      setSessionBuyInCashOut,
      endActiveSession,
      discardActiveSession,
      resumeStaleSession,
      closeOutStaleSession,
    ]
  );

  const sessionHistoryValue = useMemo(
    () => ({
      sessionHistory,
      isLoaded,
      toggleSessionStar,
      deleteSession,
      clearAllSessions,
      mergeSessionsFromCloud,
      markSessionsSynced,
      releaseAccountSessions,
    }),
    [sessionHistory, isLoaded, toggleSessionStar, deleteSession, clearAllSessions, mergeSessionsFromCloud, markSessionsSynced, releaseAccountSessions]
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