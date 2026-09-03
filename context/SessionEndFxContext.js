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
export function SessionEndFxProvider({ children, onNavigate }) {
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const [fx, setFx] = useState(null);
  const commitRef = useRef(null);

  // Called by a tracker screen instead of ending the session directly.
  // `onCommit` is what actually ends it, deferred until the wash hides it.
  const endSessionWithFx = useCallback(({ net = 0, gameType = null, onCommit = null }) => {
    commitRef.current = onCommit;
    setFx({ net, gameType });
  }, []);

  const handleCover = useCallback(() => {
    onNavigate?.();
  }, [onNavigate]);

  const handleCommit = useCallback(() => {
    commitRef.current?.();
    commitRef.current = null;
  }, []);

  const handleDone = useCallback(() => setFx(null), []);

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
