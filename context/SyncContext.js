import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { useSessionHistory } from './SessionContext';
import { pushSessions, deleteCloudSessions, pullSessions } from '../services/syncService';
import {
  loadPendingCloudDeletes,
  addPendingCloudDeletes,
  removePendingCloudDeletes,
} from '../services/storageService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only UUID-keyed sessions can sync — the `sessions` table's id column is
// `uuid`, and the id doubles as the cross-device dedup key. Pre-auth builds
// used a Date.now()-based id; any of those still sitting in a device's
// AsyncStorage stay local-only rather than being remapped, since remapping
// would desync the local copy's id from whatever gets pushed and cause it
// to look "new" (and get re-pushed under a fresh id) on every reconciliation.
function isSyncable(session) {
  return UUID_RE.test(session.id || '');
}

// Errors known to be transient clock-skew races (e.g. PostgREST rejecting a
// freshly-minted JWT as "issued at future" because its own clock hasn't
// caught up yet) rather than a real, retry-proof failure — auth errors, RLS
// violations, bad payloads, etc. are left alone since retrying won't help.
const TRANSIENT_ERROR_CODES = new Set(['PGRST303']);
export const TRANSIENT_RETRY_DELAY_MS = 1500;

function isTransientSyncError(error) {
  return !!error && TRANSIENT_ERROR_CODES.has(error.code);
}

// The one field a session can still change after it's otherwise complete.
// The write-through effect keys its "already synced, nothing to do" set on
// this instead of bare id membership, so a star toggle on a session that
// synced long ago gets re-pushed instead of silently staying local-only.
function syncVersion(session) {
  return session.starredAt || 0;
}

// Wraps a syncService call (pushSessions/pullSessions/deleteCloudSessions,
// all of which resolve to an object with an `error` field) and retries it
// once, after a short delay, if the first attempt failed with a transient
// error. Without this, a single unlucky clock-skew race permanently strands
// that data — the effect that made the call has already moved on by the
// time nothing else happens to re-trigger it.
async function withTransientRetry(operation) {
  const first = await operation();
  if (!isTransientSyncError(first.error)) return first;
  await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
  return operation();
}

// Sync status, surfaced so the UI can say whether the cloud actually has the
// data. Without this the app looked identical whether every push was
// succeeding or every push was failing, and the README promises sessions
// "survive a new phone" — someone would only find out otherwise when they
// got one.
//
// Deliberately kept out of SessionContext: this is presentation state about
// the sync process, and putting it in either session context would make every
// screen reading history re-render on each status change.
const SyncStatusContext = createContext(null);

const IDLE_STATUS = { state: 'idle', lastSyncedAt: null, error: null };

export function SyncStatusProvider({ children }) {
  const [status, setStatus] = useState(IDLE_STATUS);
  const value = useMemo(() => ({ ...status, setStatus }), [status]);
  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

// Safe outside the provider — callers get a permanent idle rather than a
// throw, since a missing status is never worth crashing a screen over.
export function useSyncStatus() {
  return useContext(SyncStatusContext) ?? { ...IDLE_STATUS, setStatus: () => {} };
}

// Watches auth state + the cold-path sessionHistory context and keeps
// Supabase in sync in the background. Deliberately reads only
// SessionHistoryContext (never ActiveSessionContext) so the app's hottest
// update path — live hand-by-hand logging — is untouched by any of this.
export function useSyncEngine() {
  const { user } = useAuth();
  const {
    sessionHistory,
    isLoaded,
    mergeSessionsFromCloud,
    markSessionsSynced,
    dropSessionsDeletedElsewhere,
  } = useSessionHistory();
  const { setStatus } = useSyncStatus();

  const reportSyncing = useCallback(
    () => setStatus((prev) => ({ ...prev, state: 'syncing', error: null })),
    [setStatus]
  );
  const reportSynced = useCallback(
    () => setStatus({ state: 'synced', lastSyncedAt: Date.now(), error: null }),
    [setStatus]
  );
  const reportFailed = useCallback(
    (error) => setStatus((prev) => ({ ...prev, state: 'error', error: error?.message || 'Sync failed' })),
    [setStatus]
  );

  // Returning to the foreground is the one moment worth retrying on its own.
  // The write-through effect below only fires when sessionHistory changes, so
  // a push that failed while offline would sit unretried until the user
  // happened to record another session — which could be days, or never.
  const [foregroundNonce, setForegroundNonce] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setForegroundNonce((n) => n + 1);
    });
    return () => sub?.remove?.();
  }, []);

  const lastUserId = useRef(null);
  // id -> syncVersion(session) as of the last confirmed push/pull, so the
  // write-through effect below can tell "already synced, untouched since"
  // apart from "already synced, but starred locally after the fact."
  const knownVersions = useRef(new Map());
  const hasReconciled = useRef(false);
  // True for the whole span of an in-flight reconciliation (pull -> merge ->
  // push), not just before it starts. Reconciling reads sessionHistory and
  // writes it back (via mergeSessionsFromCloud), which is itself a dependency
  // of this effect and of the write-through effect below — without this flag,
  // that self-triggered re-render used to be misread as "already reconciled,
  // safe to write-through," causing the write-through effect to independently
  // push the same not-yet-known-as-synced sessions a second time.
  const isReconciling = useRef(false);
  const lastForegroundNonce = useRef(0);
  // In-memory twin of the stored pending-deletes list, updated synchronously.
  // Storage writes are async, so a reconciliation starting in the instant
  // between a local delete and its id reaching storage could otherwise pull
  // that session straight back in.
  const pendingDeletes = useRef(new Set());
  // Bumped when a reconciliation finishes, so the write-through effect runs
  // straight after it. Anything deleted mid-reconcile is skipped by the
  // write-through (it bails while reconciling), and without this it would
  // wait for some unrelated history change before reaching the cloud.
  const [reconcileCount, setReconcileCount] = useState(0);

  // On sign-in (null -> user), run the one-time reconciliation across all
  // three (well, four) sync cases: backfill any legacy non-UUID ids so they
  // satisfy the `uuid` column, pull whatever the account already has in the
  // cloud, merge it into local history, then push whatever's local-only —
  // skipping anything already tagged as belonging to a *different* account
  // on this device (the account-switch guard).
  useEffect(() => {
    if (!isLoaded) return;
    const userId = user?.id ?? null;

    if (userId && userId !== lastUserId.current) {
      hasReconciled.current = false;
    }
    lastUserId.current = userId;

    // A foreground event re-opens reconciliation so a previously failed sync
    // gets another attempt. Reconciling is a pull + merge + push of what is
    // already known, and pushSessions upserts by id, so repeating it is safe.
    if (foregroundNonce !== lastForegroundNonce.current) {
      lastForegroundNonce.current = foregroundNonce;
      if (userId) hasReconciled.current = false;
    }

    if (!userId || hasReconciled.current || isReconciling.current) return;
    isReconciling.current = true;

    (async () => {
      try {
        reportSyncing();

        // Deletes that never reached the cloud go first. Whether or not they
        // land now, their ids are kept out of what the pull merges back in.
        const storedPending = await loadPendingCloudDeletes(userId);
        const pending = new Set([...storedPending, ...pendingDeletes.current]);
        if (pending.size) {
          const ids = [...pending];
          const { error: deleteError } = await withTransientRetry(() => deleteCloudSessions(userId, ids));
          if (!deleteError) {
            ids.forEach((id) => pendingDeletes.current.delete(id));
            await removePendingCloudDeletes(userId, ids);
          }
        }

        const { sessions: pulled, error: pullError } = await withTransientRetry(() => pullSessions(userId));
        if (pullError) reportFailed(pullError);
        const cloudSessions = pulled.filter((s) => s && !pending.has(s.id));
        mergeSessionsFromCloud(cloudSessions.map((s) => ({ ...s, syncedUserId: userId })));
        const cloudById = new Map(cloudSessions.map((s) => [s.id, s]));

        const eligible = sessionHistory.filter((s) => {
          const owner = s.syncedUserId ?? null;
          if (owner && owner !== userId) return false;
          return isSyncable(s);
        });

        // A session already synced to this account that a complete pull no
        // longer returns was deleted on another device, so it goes here too.
        // Pushing it back, as this used to, meant deletes never stuck.
        //
        // Skipped when the pull failed, since nothing can be inferred from a
        // failed pull. Also skipped when the account came back completely
        // empty: that's an "erase everything" on another device, but it's
        // also what a wiped table or a broken select policy looks like, and
        // this device's copy may then be the only one left.
        const canInferDeletes = !pullError && cloudSessions.length > 0;
        const deletedElsewhere = canInferDeletes
          ? eligible.filter((s) => s.syncedUserId === userId && !cloudById.has(s.id)).map((s) => s.id)
          : [];
        const deletedElsewhereIds = new Set(deletedElsewhere);
        if (deletedElsewhere.length) dropSessionsDeletedElsewhere(deletedElsewhere);

        // Only push what the cloud doesn't already have: sessions never
        // synced, and synced ones starred here more recently than the cloud
        // copy. Re-upserting the whole history on every foreground was most
        // of what each sync cost.
        const toPush = eligible.filter((s) => {
          if (s.syncedUserId !== userId) return true;
          const cloud = cloudById.get(s.id);
          return !!cloud && syncVersion(s) > syncVersion(cloud);
        });
        const toPushIds = new Set(toPush.map((s) => s.id));

        const { error } = await withTransientRetry(() => pushSessions(userId, toPush));
        if (error) reportFailed(error);
        else if (!pullError) reportSynced();
        if (!error && toPush.length) markSessionsSynced(toPush.map((s) => s.id), userId);

        // Everything is "known" at its current version except what still
        // needs pushing, so the write-through effect retries exactly that.
        // Synced sessions the pull couldn't vouch for are known too, which
        // stops write-through re-pushing (and resurrecting) them.
        const known = new Map(cloudSessions.map((s) => [s.id, syncVersion(s)]));
        eligible.forEach((s) => {
          if (deletedElsewhereIds.has(s.id)) return;
          if (toPushIds.has(s.id)) {
            if (!error) known.set(s.id, syncVersion(s));
            return;
          }
          if (!known.has(s.id)) known.set(s.id, syncVersion(s));
        });
        knownVersions.current = known;
      } catch (err) {
        reportFailed(err);
      } finally {
        hasReconciled.current = true;
        isReconciling.current = false;
        setReconcileCount((n) => n + 1);
      }
    })();
  }, [
    user,
    isLoaded,
    sessionHistory,
    mergeSessionsFromCloud,
    markSessionsSynced,
    dropSessionsDeletedElsewhere,
    foregroundNonce,
    reportSyncing,
    reportSynced,
    reportFailed,
  ]);

  // Ongoing write-through: after the initial reconciliation, diff the
  // current sessions against the last-known-synced versions on every change —
  // new ids and ids whose syncVersion moved on (a star toggled) get pushed,
  // ids that disappeared (deleteSession / clearAllSessions) get deleted from
  // the cloud too. pushSessions upserts by id, so re-pushing an id that's
  // already in the cloud is just an update, not a duplicate.
  useEffect(() => {
    if (!isLoaded || !user?.id || !hasReconciled.current || isReconciling.current) return;
    const userId = user.id;

    const eligible = sessionHistory.filter((s) => {
      const owner = s.syncedUserId ?? null;
      if (owner && owner !== userId) return false;
      return isSyncable(s);
    });
    const currentIds = new Set(eligible.map((s) => s.id));

    const toPush = eligible.filter((s) => {
      const known = knownVersions.current.get(s.id);
      return known === undefined || known !== syncVersion(s);
    });
    const removedIds = [...knownVersions.current.keys()].filter((id) => !currentIds.has(id));

    // Only mark an id "known" at its current version (skip on future diffs)
    // once we've confirmed it was actually pushed — a failed push, or one
    // never attempted, must stay eligible for retry.
    knownVersions.current = new Map(
      [...knownVersions.current].filter(([id]) => currentIds.has(id))
    );
    if (!toPush.length && !removedIds.length) return;

    (async () => {
      reportSyncing();
      let failure = null;
      if (toPush.length) {
        const { error } = await withTransientRetry(() => pushSessions(userId, toPush));
        if (error) {
          failure = error;
        } else {
          markSessionsSynced(toPush.map((s) => s.id), userId);
          toPush.forEach((s) => knownVersions.current.set(s.id, syncVersion(s)));
        }
      }
      if (removedIds.length) {
        // Recorded before the request, so a delete that fails (or never gets
        // sent because the app dies) is retried by the next reconciliation
        // instead of being undone by its pull.
        removedIds.forEach((id) => pendingDeletes.current.add(id));
        await addPendingCloudDeletes(userId, removedIds);
        const { error } = await withTransientRetry(() => deleteCloudSessions(userId, removedIds));
        if (error) {
          failure = failure || error;
          removedIds.forEach((id) => knownVersions.current.set(id, 0));
        } else {
          removedIds.forEach((id) => pendingDeletes.current.delete(id));
          await removePendingCloudDeletes(userId, removedIds);
        }
      }
      if (failure) reportFailed(failure);
      else reportSynced();
    })();
  }, [sessionHistory, isLoaded, user, markSessionsSynced, reportSyncing, reportSynced, reportFailed, reconcileCount]);

  // Reset local sync bookkeeping on sign-out so a later sign-in re-runs
  // reconciliation instead of assuming the previous account's state.
  useEffect(() => {
    if (!user) {
      hasReconciled.current = false;
      isReconciling.current = false;
      knownVersions.current = new Map();
      // The stored list is per account and survives this; only the
      // in-memory copy belongs to the account that just signed out.
      pendingDeletes.current = new Set();
      setStatus(IDLE_STATUS);
    }
  }, [user, setStatus]);
}

// Manual "pull down to refresh" for screens that show history. Deliberately
// separate from useSyncEngine's reconciliation: it only ever pulls and merges,
// and mergeSessionsFromCloud dedupes by id, so calling it repeatedly is safe
// and can't disturb the engine's push bookkeeping.
//
// Returns null when signed out — there is no cloud to pull from, so the caller
// should leave the refresh control off rather than spin on nothing.
export function useCloudRefresh() {
  const { user } = useAuth();
  const { mergeSessionsFromCloud } = useSessionHistory();
  const userId = user?.id ?? null;

  return useMemo(() => {
    if (!userId) return null;
    return async () => {
      const [{ sessions, error }, pending] = await Promise.all([
        pullSessions(userId),
        loadPendingCloudDeletes(userId),
      ]);
      if (error) return;
      // Sessions deleted here whose cloud delete hasn't landed yet stay deleted.
      const pendingIds = new Set(pending);
      mergeSessionsFromCloud(
        sessions.filter((s) => s && !pendingIds.has(s.id)).map((s) => ({ ...s, syncedUserId: userId }))
      );
    };
  }, [userId, mergeSessionsFromCloud]);
}

// The raw sessionHistory from SessionContext is a single unscoped pool —
// every account that's ever signed into this device leaves its synced
// records sitting in it (by design, so the ownership guard above can keep
// excluding them from the wrong account's pushes). That's correct for
// syncing, but wrong for display: without filtering, signing into a second
// account on the same device would show the first account's history too.
// Screens that render session history for the user (as opposed to
// useSyncEngine's own bookkeeping) should use this instead of
// useSessionHistory directly.
//
// The filtered list is cached per (history array, signed-in user) rather than
// recomputed per calling screen. Ten screens call this hook, and each one's
// own useMemo used to produce its own array — identical contents, ten
// different identities. That cost more than the ten filter passes: the
// insights engines memoise their per-game slices on the identity of the array
// they're handed, so every screen was also priming its own private copy of
// that cache. One array for one set of data means they all share it.
//
// The map is weak on the raw history array, which SessionContext replaces
// wholesale on every change, so an entry becomes collectable as soon as its
// history is superseded. Frozen on the way out rather than just documented as
// read-only: ten screens share the one array, so an in-place sort or splice on
// it would reorder what all of them render. A screen that wants its own order
// copies first.
const visibleByHistory = new WeakMap();

function visibleSessionsFor(sessionHistory, userId) {
  let byUser = visibleByHistory.get(sessionHistory);
  if (!byUser) {
    byUser = new Map();
    visibleByHistory.set(sessionHistory, byUser);
  }
  const cached = byUser.get(userId);
  if (cached) return cached;

  const visible = sessionHistory.filter((s) => {
    const owner = s.syncedUserId ?? null;
    return !owner || owner === userId;
  });
  Object.freeze(visible);
  byUser.set(userId, visible);
  return visible;
}

export function useVisibleSessionHistory() {
  const { user } = useAuth();
  const { sessionHistory, ...rest } = useSessionHistory();
  const userId = user?.id ?? null;

  const visibleSessionHistory = useMemo(
    () => visibleSessionsFor(sessionHistory, userId),
    [sessionHistory, userId]
  );

  return { ...rest, sessionHistory: visibleSessionHistory };
}
