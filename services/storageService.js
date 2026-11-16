import AsyncStorage from '@react-native-async-storage/async-storage';

// Bump this if the stored data shape ever changes in a breaking way.
const SCHEMA_VERSION = 1;

const KEYS = {
  SESSION_HISTORY: 'ante:sessionHistory',
  // Pre-multi-session key, holding a single live session. Nothing reads or
  // writes it any more — ACTIVE_SESSIONS replaced it — but it stays listed so
  // clearAllAppData still sweeps whatever an older build left on the device.
  LEGACY_ACTIVE_SESSION: 'ante:activeSession',
  ACTIVE_SESSIONS: 'ante:activeSessions',
  PREFERENCES: 'ante:preferences',
  DEVICE_ID: 'ante:deviceId',
  SCHEMA_VERSION: 'ante:schemaVersion',
  // Which version of the Terms/Privacy Policy this device accepted, and when.
  LEGAL_CONSENT: 'ante:legalConsent',
  // userId -> session ids deleted locally whose cloud delete hasn't succeeded.
  PENDING_CLOUD_DELETES: 'ante:pendingCloudDeletes',
};

// The only keys a "clear my data" leaves behind. The device seed is anonymous
// and is what lets local data map onto an account later, so wiping it would
// make a reset install look brand new rather than like the same device.
//
// The consent record is preserved for a second reason: it is the evidence that
// this device was shown the Terms and accepted them. Erasing session data is
// not a withdrawal of that acceptance, and dropping the record would destroy
// the only proof we have that the gate was ever answered.
//
// Pending cloud deletes are kept because they record deletions the user
// already made. Dropping them would let the next sync pull those sessions
// back down from the account.
const PRESERVED_KEYS = [KEYS.DEVICE_ID, KEYS.LEGAL_CONSENT, KEYS.PENDING_CLOUD_DELETES];

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

// --- Legal consent ---
//
// Written once by the consent gate and read on every launch. Kept in its own
// key rather than inside preferences, because resetPreferences() exists and
// would otherwise silently revoke a recorded acceptance.

export async function loadLegalConsent() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LEGAL_CONSENT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A blob that isn't an object — an array, a bare null, a string written by
    // some older build — can't carry a version, so treat it as no consent at
    // all and re-prompt, rather than letting an undefined version slip past
    // the equality check in the gate.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch (err) {
    console.error('storageService: failed to load legal consent', err);
    return null;
  }
}

export async function saveLegalConsent(record) {
  try {
    await AsyncStorage.setItem(KEYS.LEGAL_CONSENT, JSON.stringify(record));
    return true;
  } catch (err) {
    console.error('storageService: failed to save legal consent', err);
    return false;
  }
}

// --- Session history ---
//
// Resolves to `null`, not `[]`, when the stored history exists but can't be
// read. The difference is the whole point: SessionProvider persists whatever
// history it holds, so a read failure reported as "no sessions" would be
// written straight back over the data it failed to read. That can happen on
// a transient storage error, and on Android it's what a single oversized
// value looks like ("Row too big to fit into CursorWindow").
export async function loadSessionHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSION_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Valid JSON that isn't a list holds no sessions to protect.
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('storageService: failed to load session history', err);
    return null;
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

// --- Active sessions ---
//
// A map of gameType -> live session, mirroring SessionContext's own shape, so
// at most one session per game survives a restart. Persisting these is what
// stops an OS memory kill (indistinguishable from a deliberate force-quit)
// from destroying a session that's already been logged into.

export async function loadActiveSessions() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ACTIVE_SESSIONS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Both `null` and an array are valid JSON that would sail through
    // JSON.parse and then break every caller that expects a keyed map.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (err) {
    console.error('storageService: failed to load active sessions', err);
    return {};
  }
}

export async function saveActiveSessions(activeSessions) {
  try {
    if (!activeSessions || Object.keys(activeSessions).length === 0) {
      await AsyncStorage.removeItem(KEYS.ACTIVE_SESSIONS);
    } else {
      await AsyncStorage.setItem(KEYS.ACTIVE_SESSIONS, JSON.stringify(activeSessions));
    }
    return true;
  } catch (err) {
    console.error('storageService: failed to save active sessions', err);
    return false;
  }
}

// One-shot cleanup of the pre-multi-session key, called on startup. Cheap
// enough to run every launch, and it means a device upgrading from an older
// build doesn't carry a stranded session blob forever.
export async function clearLegacyActiveSession() {
  try {
    await AsyncStorage.removeItem(KEYS.LEGACY_ACTIVE_SESSION);
    return true;
  } catch (err) {
    console.error('storageService: failed to clear legacy active session', err);
    return false;
  }
}

// --- Pending cloud deletes ---
//
// A session deleted while offline (or while a delete request failed) still
// exists in the cloud, and the next pull would merge it straight back in.
// Recording the id here first means the sync engine can retry the delete and,
// until it lands, refuse to re-import that session.
//
// Writes are chained so two quick read-modify-write updates can't interleave
// and drop each other's ids.
let pendingDeletesQueue = Promise.resolve();

async function readPendingDeletesMap() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_CLOUD_DELETES);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.error('storageService: failed to load pending cloud deletes', err);
    return {};
  }
}

function updatePendingDeletes(userId, update) {
  pendingDeletesQueue = pendingDeletesQueue.then(async () => {
    try {
      const map = await readPendingDeletesMap();
      const next = update(new Set(Array.isArray(map[userId]) ? map[userId] : []));
      if (next.size) map[userId] = [...next];
      else delete map[userId];
      if (Object.keys(map).length) {
        await AsyncStorage.setItem(KEYS.PENDING_CLOUD_DELETES, JSON.stringify(map));
      } else {
        await AsyncStorage.removeItem(KEYS.PENDING_CLOUD_DELETES);
      }
    } catch (err) {
      console.error('storageService: failed to save pending cloud deletes', err);
    }
  });
  return pendingDeletesQueue;
}

export async function loadPendingCloudDeletes(userId) {
  if (!userId) return [];
  await pendingDeletesQueue;
  const ids = (await readPendingDeletesMap())[userId];
  return Array.isArray(ids) ? ids : [];
}

export function addPendingCloudDeletes(userId, ids) {
  if (!userId || !ids?.length) return Promise.resolve();
  return updatePendingDeletes(userId, (set) => {
    ids.forEach((id) => set.add(id));
    return set;
  });
}

export function removePendingCloudDeletes(userId, ids) {
  if (!userId || !ids?.length) return Promise.resolve();
  return updatePendingDeletes(userId, (set) => {
    ids.forEach((id) => set.delete(id));
    return set;
  });
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
  } catch {
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

// --- Full reset (backs Profile's "Erase all session data") ---
//
// Derived from KEYS minus PRESERVED_KEYS rather than an enumerated list, so a
// key added later is swept by default instead of by remembering to add it
// here. The enumerated version had already drifted: it missed the live-session
// key, which would have left a session running after the user erased
// everything — the one outcome that confirmation dialog promises can't happen.
export async function clearAllAppData() {
  try {
    await AsyncStorage.multiRemove(
      Object.values(KEYS).filter((key) => !PRESERVED_KEYS.includes(key))
    );
    return true;
  } catch (err) {
    console.error('storageService: failed to clear app data', err);
    return false;
  }
}