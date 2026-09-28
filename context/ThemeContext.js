import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { PALETTES, setColorScheme } from '../constants/theme';
import { FONT_FILES } from '../constants/fonts';

// Appearance: which palette the app draws with, and the fonts it draws in.
//
// Sits above every other provider — the consent gate and the crash screen are
// drawn too — so it keeps its own storage key rather than living in
// PreferencesContext, which only mounts after consent. It is a display
// setting kept on the device, never synced.

const STORAGE_KEY = '@ante/appearance';
export const APPEARANCE_OPTIONS = ['light', 'dark', 'system'];
const DEFAULT_APPEARANCE = 'light';

const ThemeContext = createContext({
  scheme: 'light',
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
});

export function ThemeProvider({ children }) {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const [appearance, setAppearanceState] = useState(null);
  const systemScheme = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled) {
          setAppearanceState(APPEARANCE_OPTIONS.includes(stored) ? stored : DEFAULT_APPEARANCE);
        }
      })
      .catch(() => {
        if (!cancelled) setAppearanceState(DEFAULT_APPEARANCE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAppearance = useCallback((next) => {
    if (!APPEARANCE_OPTIONS.includes(next)) return;
    setAppearanceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme =
    (appearance === 'system' ? systemScheme : appearance) === 'dark' ? 'dark' : 'light';

  // Swapped during render, before any child reads a colour, so the first
  // frame drawn after a change is already in the new palette.
  setColorScheme(scheme);

  const value = useMemo(
    () => ({ scheme, appearance: appearance ?? DEFAULT_APPEARANCE, setAppearance }),
    [scheme, appearance, setAppearance]
  );

  // A font that fails to load falls back to the system face rather than
  // holding the app on a blank screen.
  if (appearance === null || (!fontsLoaded && !fontError)) {
    return <View style={{ flex: 1, backgroundColor: PALETTES[scheme].background }} />;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
