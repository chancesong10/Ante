import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Mirrors the `hapticsEnabled` preference. Kept at module scope rather than
// read from context, so the ~40 call sites stay plain function calls instead
// of each needing a hook. PreferencesContext pushes the value in on change.
let enabled = true;

export const setHapticsEnabled = (value) => {
  enabled = value !== false;
};

const off = () => !enabled || Platform.OS === 'web';

export const hapticLight = () => {
  if (!off()) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

export const hapticMedium = () => {
  if (!off()) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
};

export const hapticHeavy = () => {
  if (!off()) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }
};

export const hapticSuccess = () => {
  if (!off()) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
};

export const hapticWarning = () => {
  if (!off()) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }
};

export const hapticError = () => {
  if (!off()) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }
};

export const hapticSelection = () => {
  if (!off()) {
    Haptics.selectionAsync().catch(() => {});
  }
};
