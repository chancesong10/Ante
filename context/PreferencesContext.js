import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadPreferences, savePreferences } from '../services/storageService';

const PreferencesContext = createContext();

export const DEFAULT_QUICK_CHIP_PRESETS = {
  blackjack: ['10', '25', '50', '100', '250'],
  sports: ['10', '25', '50', '100', '250'],
  poker: ['1', '5', '25', '50', '100', '500'],
};

const DEFAULT_PREFERENCES = {
  quickChipsEnabled: true,
  username: 'Ante Highroller',
  currency: 'USD ($)',
  currencySymbol: '$',
  privacyMode: false,
  hapticsEnabled: true,
  stopLossAlert: false,
  stopLossAmount: 250,
  quickChipPresets: DEFAULT_QUICK_CHIP_PRESETS,
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
          // Ensure every game key exists even if the stored blob predates a game
          // or was written before this preference was introduced.
          quickChipPresets: {
            ...DEFAULT_QUICK_CHIP_PRESETS,
            ...(stored.quickChipPresets || {}),
          },
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

  // Persist the quick-chip denominations for a single game ('blackjack' |
  // 'poker' | 'sports') without disturbing the others.
  const setQuickChipPreset = useCallback((game, chips) => {
    setPreferences((prev) => ({
      ...prev,
      quickChipPresets: {
        ...DEFAULT_QUICK_CHIP_PRESETS,
        ...prev.quickChipPresets,
        [game]: chips,
      },
    }));
  }, []);

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
      setQuickChipPreset,
      resetPreferences,
    }),
    [preferences, isLoaded, updatePreferences, setQuickChipsEnabled, setQuickChipPreset, resetPreferences]
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