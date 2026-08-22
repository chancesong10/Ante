import { useEffect, useRef } from 'react';
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

    if (!userId || hasReconciled.current) return;
    hasReconciled.current = true;

    (async () => {
      const { sessions: cloudSessions } = await pullSessions(userId);
      mergeSessionsFromCloud(cloudSessions.map((s) => ({ ...s, syncedUserId: userId })));

      const toPush = sessionHistory.filter((s) => {
        const owner = s.syncedUserId ?? null;
        if (owner && owner !== userId) return false;
        return isSyncable(s);
      });

      const { error } = await pushSessions(userId, toPush);
      const pushedIds = error ? [] : toPush.map((s) => s.id);
      if (pushedIds.length) markSessionsSynced(pushedIds, userId);
      knownIds.current = new Set([...cloudSessions.map((s) => s.id), ...pushedIds]);
    })();
  }, [user, isLoaded, sessionHistory, mergeSessionsFromCloud, markSessionsSynced]);

  // Ongoing write-through: after the initial reconciliation, diff the
  // current session-id set against the last-known-synced set on every
  // change — new ids get pushed, ids that disappeared (deleteSession /
  // clearAllSessions) get deleted from the cloud too.
  useEffect(() => {
    if (!isLoaded || !user?.id || !hasReconciled.current) return;
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
        const { error } = await pushSessions(userId, newSessions);
        if (!error) {
          markSessionsSynced(newSessions.map((s) => s.id), userId);
          newSessions.forEach((s) => knownIds.current.add(s.id));
        }
      }
      if (removedIds.length) {
        const { error } = await deleteCloudSessions(userId, removedIds);
        if (error) removedIds.forEach((id) => knownIds.current.add(id));
      }
    })();
  }, [sessionHistory, isLoaded, user, markSessionsSynced]);

  // Reset local sync bookkeeping on sign-out so a later sign-in re-runs
  // reconciliation instead of assuming the previous account's state.
  useEffect(() => {
    if (!user) {
      hasReconciled.current = false;
      knownIds.current = new Set();
    }
  }, [user]);
}
