import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadPreferences, savePreferences } from '../services/storageService';

const PreferencesContext = createContext();

const DEFAULT_PREFERENCES = {
  quickChipsEnabled: true,
  username: 'Ante Highroller',
  currency: 'USD ($)',
  currencySymbol: '$',
  privacyMode: false,
  hapticsEnabled: true,
  stopLossAlert: false,
  stopLossAmount: 250,
  // Dev-only stand-in for real subscription entitlement. Every behavioral
  // insights screen checks this one flag to decide whether to show the
  // paywall blur. When real subscriptions ship, this becomes the result
  // of a RevenueCat/App Store entitlement check instead of a manual
  // switch — nothing else in the app should need to change.
  proUnlocked: false,
};

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (hasLoadedOnce.current) return;
    hasLoadedOnce.current = true;

    (async () => {
      const stored = await loadPreferences();
      if (stored) {
        let symbol = stored.currencySymbol;
        let curr = stored.currency;
        if (curr?.startsWith('CAD') || symbol === 'CA$') {
          symbol = '$';
          curr = 'CAD ($)';
        } else if (curr?.startsWith('BTC') || symbol === '₿') {
          symbol = '$';
          curr = 'USD ($)';
        }
        setPreferences((prev) => ({
          ...prev,
          ...stored,
          ...(symbol ? { currencySymbol: symbol } : {}),
          ...(curr ? { currency: curr } : {}),
        }));
      }
      setIsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    savePreferences(preferences);
  }, [preferences, isLoaded]);

  const updatePreferences = useCallback((partial) => {
    setPreferences((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  const setQuickChipsEnabled = useCallback((value) => {
    updatePreferences({ quickChipsEnabled: value });
  }, [updatePreferences]);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  // Recomputed only when preferences/isLoaded actually change, so this
  // provider's re-renders don't force every consuming screen to re-render
  // with identical data.
  const value = useMemo(
    () => ({
      ...preferences,
      preferences,
      isLoaded,
      updatePreferences,
      setQuickChipsEnabled,
      resetPreferences,
    }),
    [preferences, isLoaded, updatePreferences, setQuickChipsEnabled, resetPreferences]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}