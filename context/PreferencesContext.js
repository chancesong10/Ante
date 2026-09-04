import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadPreferences, savePreferences } from '../services/storageService';
import { setHapticsEnabled } from '../utils/haptics';
import { DEFAULT_GAME_ORDER, sanitizeGameOrder } from '../constants/games';

const PreferencesContext = createContext();

// Defaults follow what's actually on a table, so the first tap usually lands
// on a real chip instead of a round number nobody stacks.
//
// Casino floors run a near-universal colour ladder: $1 white, $5 red, $25
// green, $100 black, $500 purple, $1,000 orange. $50 and $250 — which these
// presets used to lead with — aren't part of it; you make $50 with two greens.
//
// Sports betting isn't chips at all, it's cash stakes, so it gets its own
// ladder. Standard bankroll guidance is 1–3% of roll per bet, and recreational
// rolls sit around $200–$1,000, which puts the common stake between $5 and
// $25 with $50/$100 for bigger plays.
//
// All of it is editable in Profile → Quick Chip Presets; this is only the
// starting point.
export const DEFAULT_QUICK_CHIP_PRESETS = {
  // The classic five-colour ladder. Bets are built by stacking these.
  blackjack: ['1', '5', '25', '100', '500'],
  // Same ladder plus the orange $1,000 for the sixth slot.
  poker: ['1', '5', '25', '100', '500', '1000'],
  // Cash stakes, not chips — round numbers around a typical unit size.
  sports: ['5', '10', '25', '50', '100'],
  // Roulette and baccarat are both chip games at the table, same ladder as blackjack.
  roulette: ['1', '5', '25', '100', '500'],
  baccarat: ['1', '5', '25', '100', '500'],
};

const DEFAULT_PREFERENCES = {
  quickChipsEnabled: true,
  currency: 'USD ($)',
  currencySymbol: '$',
  privacyMode: false,
  hapticsEnabled: true,
  stopLossAlert: false,
  stopLossAmount: 250,
  quickChipPresets: DEFAULT_QUICK_CHIP_PRESETS,
  // Which order the Start Session sheet lists its game cards in. Lives here
  // rather than as sheet-local state so it's set once in Settings and just
  // shows up the next time the sheet opens.
  gameOrder: DEFAULT_GAME_ORDER,
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
          // Same idea for game order: reconcile against whatever games exist
          // today rather than trusting a blob that might predate one of them.
          gameOrder: sanitizeGameOrder(stored.gameOrder),
        }));
      }
      setIsLoaded(true);
    })();
  }, []);

  // Debounced so a burst of changes — flipping a switch, or typing through
  // the chip-preset inputs — coalesces into one write instead of hitting
  // AsyncStorage on every keystroke/tap and competing with the animation
  // running on the same JS thread.
  useEffect(() => {
    if (!isLoaded) return undefined;
    const t = setTimeout(() => savePreferences(preferences), 250);
    return () => clearTimeout(t);
  }, [preferences, isLoaded]);

  // Push the haptics preference down to the module the whole app calls into.
  useEffect(() => {
    setHapticsEnabled(preferences.hapticsEnabled);
  }, [preferences.hapticsEnabled]);

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