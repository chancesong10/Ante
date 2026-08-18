import React, { createContext, useContext, useState } from 'react';

const PreferencesContext = createContext();

export function PreferencesProvider({ children }) {
  const [quickChipsEnabled, setQuickChipsEnabled] = useState(true);

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