import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSessionHistory } from './SessionContext';
import { pushSessions, deleteCloudSessions, pullSessions } from '../services/syncService';

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

// Watches auth state + the cold-path sessionHistory context and keeps
// Supabase in sync in the background. Deliberately reads only
// SessionHistoryContext (never ActiveSessionContext) so the app's hottest
// update path — live hand-by-hand logging — is untouched by any of this.
export function useSyncEngine() {
  const { user } = useAuth();
  const { sessionHistory, isLoaded, mergeSessionsFromCloud, markSessionsSynced } = useSessionHistory();

  const lastUserId = useRef(null);
  const knownIds = useRef(new Set());
  const hasReconciled = useRef(false);
  // True for the whole span of an in-flight reconciliation (pull -> merge ->
  // push), not just before it starts. Reconciling reads sessionHistory and
  // writes it back (via mergeSessionsFromCloud), which is itself a dependency
  // of this effect and of the write-through effect below — without this flag,
  // that self-triggered re-render used to be misread as "already reconciled,
  // safe to write-through," causing the write-through effect to independently
  // push the same not-yet-known-as-synced sessions a second time.
  const isReconciling = useRef(false);

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

    if (!userId || hasReconciled.current || isReconciling.current) return;
    isReconciling.current = true;

    (async () => {
      try {
        const { sessions: cloudSessions } = await withTransientRetry(() => pullSessions(userId));
        mergeSessionsFromCloud(cloudSessions.map((s) => ({ ...s, syncedUserId: userId })));

        const toPush = sessionHistory.filter((s) => {
          const owner = s.syncedUserId ?? null;
          if (owner && owner !== userId) return false;
          return isSyncable(s);
        });

        const { error } = await withTransientRetry(() => pushSessions(userId, toPush));
        const pushedIds = error ? [] : toPush.map((s) => s.id);
        if (pushedIds.length) markSessionsSynced(pushedIds, userId);
        knownIds.current = new Set([...cloudSessions.map((s) => s.id), ...pushedIds]);
      } finally {
        hasReconciled.current = true;
        isReconciling.current = false;
      }
    })();
  }, [user, isLoaded, sessionHistory, mergeSessionsFromCloud, markSessionsSynced]);

  // Ongoing write-through: after the initial reconciliation, diff the
  // current session-id set against the last-known-synced set on every
  // change — new ids get pushed, ids that disappeared (deleteSession /
  // clearAllSessions) get deleted from the cloud too.
  useEffect(() => {
    if (!isLoaded || !user?.id || !hasReconciled.current || isReconciling.current) return;
    const userId = user.id;

    const eligible = sessionHistory.filter((s) => {
      const owner = s.syncedUserId ?? null;
      if (owner && owner !== userId) return false;
      return isSyncable(s);
    });
    const currentIds = new Set(eligible.map((s) => s.id));

    const newSessions = eligible.filter((s) => !knownIds.current.has(s.id));
    const removedIds = [...knownIds.current].filter((id) => !currentIds.has(id));

    // Only mark ids "known" (skip on future diffs) once we've confirmed they
    // were actually pushed — a failed push must stay eligible for retry.
    knownIds.current = new Set([...knownIds.current].filter((id) => currentIds.has(id)));
    if (!newSessions.length && !removedIds.length) return;

    (async () => {
      if (newSessions.length) {
        const { error } = await withTransientRetry(() => pushSessions(userId, newSessions));
        if (!error) {
          markSessionsSynced(newSessions.map((s) => s.id), userId);
          newSessions.forEach((s) => knownIds.current.add(s.id));
        }
      }
      if (removedIds.length) {
        const { error } = await withTransientRetry(() => deleteCloudSessions(userId, removedIds));
        if (error) removedIds.forEach((id) => knownIds.current.add(id));
      }
    })();
  }, [sessionHistory, isLoaded, user, markSessionsSynced]);

  // Reset local sync bookkeeping on sign-out so a later sign-in re-runs
  // reconciliation instead of assuming the previous account's state.
  useEffect(() => {
    if (!user) {
      hasReconciled.current = false;
      isReconciling.current = false;
      knownIds.current = new Set();
    }
  }, [user]);
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
export function useVisibleSessionHistory() {
  const { user } = useAuth();
  const { sessionHistory, ...rest } = useSessionHistory();
  const userId = user?.id ?? null;

  const visibleSessionHistory = useMemo(
    () =>
      sessionHistory.filter((s) => {
        const owner = s.syncedUserId ?? null;
        return !owner || owner === userId;
      }),
    [sessionHistory, userId]
  );

  return { ...rest, sessionHistory: visibleSessionHistory };
}
