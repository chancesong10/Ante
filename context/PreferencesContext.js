import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { loadPreferences, savePreferences } from '../services/storageService';

const PreferencesContext = createContext();

const DEFAULT_PREFERENCES = {
  quickChipsEnabled: true,
};

export function PreferencesProvider({ children }) {
  const [quickChipsEnabled, setQuickChipsEnabledState] = useState(
    DEFAULT_PREFERENCES.quickChipsEnabled
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (hasLoadedOnce.current) return;
    hasLoadedOnce.current = true;

    (async () => {
      const stored = await loadPreferences();
      if (stored) {
        setQuickChipsEnabledState(
          stored.quickChipsEnabled ?? DEFAULT_PREFERENCES.quickChipsEnabled
        );
      }
      setIsLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    savePreferences({ quickChipsEnabled });
  }, [quickChipsEnabled, isLoaded]);

  const setQuickChipsEnabled = (value) => {
    setQuickChipsEnabledState(value);
  };

  return (
    <PreferencesContext.Provider
      value={{
        quickChipsEnabled,
        setQuickChipsEnabled,
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