import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import SessionEndOverlay from '../components/SessionEndOverlay';
import { usePreferences } from './PreferencesContext';

const SessionEndFxContext = createContext();

// Owns the end-of-session transition.
//
// This lives above the navigator (App.js) rather than inside a tracker screen
// on purpose: the overlay has to outlive the screen that launched it. Ending a
// session navigates away from that screen, so an overlay rendered inside it
// would unmount mid-animation and the transition would cut.
//
// The two costly steps are staged rather than fired together (see the
// timeline in SessionEndOverlay): `onNavigate` runs first, as soon as the
// wash is opaque, so History mounts out of sight; the screen's own commit
// runs later, inserting a row into a list that is already on screen.
//
// Only one wash plays at a time, but with several sessions able to run at
// once (and the stop-loss alert able to end any of them independently of
// whatever the user is manually ending), a second endSessionWithFx call can
// legitimately arrive while the first is still animating — e.g. the alert
// for session B firing right as session A's wash is covering the screen.
// That request is queued rather than clobbering the in-flight one: without
// this, the second call overwrote `fx` (the wash's colour and figure would
// snap to session B's numbers mid-animation) and `commitRef` (session A's
// own endActiveSession() would never run, silently stranding it as still
// "active"), then that stranded session's own wash would surface later,
// looking exactly like the wash replaying itself out of nowhere. Queued
// sessions each get their own full, undisturbed play-through in order.
export function SessionEndFxProvider({ children, onNavigate }) {
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const [fx, setFx] = useState(null);
  const commitRef = useRef(null);
  const queueRef = useRef([]);
  // Mirrors "is a wash currently playing" synchronously — a ref rather than
  // deriving from `fx` state, so two endSessionWithFx calls in the same tick
  // (not just ones separated by a render) still see each other correctly.
  const busyRef = useRef(false);

  const playNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      busyRef.current = false;
      return;
    }
    busyRef.current = true;
    commitRef.current = next.onCommit;
    setFx({ net: next.net, gameType: next.gameType });
  }, []);

  // Called by a tracker screen instead of ending the session directly.
  // `onCommit` is what actually ends it, deferred until the wash hides it.
  const endSessionWithFx = useCallback(
    ({ net = 0, gameType = null, onCommit = null }) => {
      queueRef.current.push({ net, gameType, onCommit });
      if (!busyRef.current) playNext();
    },
    [playNext]
  );

  const handleCover = useCallback(() => {
    onNavigate?.();
  }, [onNavigate]);

  const handleCommit = useCallback(() => {
    commitRef.current?.();
    commitRef.current = null;
  }, []);

  // Clear the finished wash, then immediately hand off to whatever queued up
  // behind it — its own COVER→COMMIT→EXIT timeline starts fresh from here.
  const handleDone = useCallback(() => {
    setFx(null);
    playNext();
  }, [playNext]);

  return (
    <SessionEndFxContext.Provider value={{ endSessionWithFx }}>
      {children}
      <SessionEndOverlay
        fx={fx}
        currencySymbol={currencySymbol}
        privacyMode={privacyMode}
        onCover={handleCover}
        onCommit={handleCommit}
        onDone={handleDone}
      />
    </SessionEndFxContext.Provider>
  );
}

export function useSessionEndFx() {
  const context = useContext(SessionEndFxContext);
  if (!context) {
    throw new Error('useSessionEndFx must be used within a SessionEndFxProvider');
  }
  return context;
}
