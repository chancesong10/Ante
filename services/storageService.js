import AsyncStorage from '@react-native-async-storage/async-storage';

// Bump this if the stored data shape ever changes in a breaking way.
const SCHEMA_VERSION = 1;

const KEYS = {
  SESSION_HISTORY: 'ante:sessionHistory',
  PREFERENCES: 'ante:preferences',
  DEVICE_ID: 'ante:deviceId',
  SCHEMA_VERSION: 'ante:schemaVersion',
};

// --- Device identity (anonymous, stable per-install) ---
// This lets today's local-only data map cleanly onto a real user account later.
export async function getOrCreateDeviceId() {
  try {
    const existing = await AsyncStorage.getItem(KEYS.DEVICE_ID);
    if (existing) return existing;

    const newId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(KEYS.DEVICE_ID, newId);
    return newId;
  } catch (err) {
    console.error('storageService: failed to get/create device ID', err);
    return null;
  }
}

// --- Session history ---
export async function loadSessionHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSION_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('storageService: failed to load session history', err);
    return [];
  }
}

export async function saveSessionHistory(sessionHistory) {
  try {
    await AsyncStorage.setItem(KEYS.SESSION_HISTORY, JSON.stringify(sessionHistory));
    return true;
  } catch (err) {
    console.error('storageService: failed to save session history', err);
    return false;
  }
}

// --- Preferences ---
export async function loadPreferences() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PREFERENCES);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('storageService: failed to load preferences', err);
    return null;
  }
}

export async function savePreferences(preferences) {
  try {
    await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(preferences));
    return true;
  } catch (err) {
    console.error('storageService: failed to save preferences', err);
    return false;
  }
}

// --- Schema version handling ---
export async function getStoredSchemaVersion() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SCHEMA_VERSION);
    return raw ? parseInt(raw, 10) : 0;
  } catch (err) {
    return 0;
  }
}

export async function setStoredSchemaVersion(version) {
  try {
    await AsyncStorage.setItem(KEYS.SCHEMA_VERSION, String(version));
  } catch (err) {
    console.error('storageService: failed to set schema version', err);
  }
}

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

// --- Full reset (useful for debugging / "clear my data" feature later) ---
export async function clearAllAppData() {
  try {
    await AsyncStorage.multiRemove([
      KEYS.SESSION_HISTORY,
      KEYS.PREFERENCES,
      KEYS.SCHEMA_VERSION,
      // Deliberately NOT clearing DEVICE_ID — that should persist even through a data reset
    ]);
    return true;
  } catch (err) {
    console.error('storageService: failed to clear app data', err);
    return false;
  }
}