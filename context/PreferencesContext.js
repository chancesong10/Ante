import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

  const updatePreferences = (partial) => {
    setPreferences((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  const setQuickChipsEnabled = (value) => {
    updatePreferences({ quickChipsEnabled: value });
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return (
    <PreferencesContext.Provider
      value={{
        ...preferences,
        preferences,
        updatePreferences,
        setQuickChipsEnabled,
        resetPreferences,
      }}
    >
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