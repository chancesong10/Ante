import { supabase } from './supabaseClient';

// Guest-only builds have no client (see supabaseClient.js). Signed out is the
// only state they can be in, so these are never reached with a user id there;
// the check just turns a would-be crash into an ordinary sync error.
const NOT_CONFIGURED = { message: 'Sync is not available in this build' };

// Access control lives in the database, not here. The `.eq('user_id', ...)`
// filters below narrow a query — they do not enforce anything: the anon key
// ships inside the app binary, so anyone can extract it and issue their own
// PostgREST requests. Row-level security on `sessions` is the only thing
// keeping one account out of another's rows. See supabase/SCHEMA_CONTRACT.md
// for the policies that have to be in place.

// Maps a locally stored session record onto the `sessions` table's columns.
// `data` keeps the full record so nothing is lost across the two divergent
// shapes (mode: 'hands' vs mode: 'buyInCashOut').
function toRow(userId, session) {
  return {
    id: session.id,
    user_id: userId,
    game_type: session.gameType,
    mode: session.mode,
    start_time: new Date(session.startTime).toISOString(),
    end_time: new Date(session.endTime).toISOString(),
    net_profit: session.netProfit || 0,
    data: session,
  };
}

export async function pushSessions(userId, sessions) {
  if (!userId || !sessions?.length) return { error: null };
  if (!supabase) return { error: NOT_CONFIGURED };
  const rows = sessions.map((s) => toRow(userId, s));
  const { error } = await supabase.from('sessions').upsert(rows, { onConflict: 'id' });
  if (error) console.error('syncService: failed to push sessions', error);
  return { error };
}

export async function deleteCloudSessions(userId, sessionIds) {
  if (!userId || !sessionIds?.length) return { error: null };
  if (!supabase) return { error: NOT_CONFIGURED };
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('user_id', userId)
    .in('id', sessionIds);
  if (error) console.error('syncService: failed to delete cloud sessions', error);
  return { error };
}

const PULL_PAGE_SIZE = 500;

// Returns the account's complete set of sessions, or an error. Never a partial
// list: the sync engine treats a synced session missing from a successful pull
// as deleted on another device, so a truncated pull would read as deletions.
//
// That's why this pages instead of issuing one request. PostgREST caps every
// response at the project's max-rows setting (1000 by default on Supabase)
// without reporting an error. Paging is keyset on `id` rather than by offset,
// so rows inserted or deleted elsewhere mid-pull can't shift a page boundary
// and skip one. It stops on an empty page rather than a short one, because a
// server cap below PULL_PAGE_SIZE would make every page look like the last.
export async function pullSessions(userId) {
  if (!userId) return { sessions: [], error: null };
  if (!supabase) return { sessions: [], error: NOT_CONFIGURED };
  const sessions = [];
  let lastId = null;
  for (;;) {
    let query = supabase
      .from('sessions')
      .select('id, data')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .limit(PULL_PAGE_SIZE);
    if (lastId) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) {
      console.error('syncService: failed to pull sessions', error);
      return { sessions: [], error };
    }
    const rows = data || [];
    if (!rows.length) break;
    rows.forEach((row) => sessions.push(row.data));
    lastId = rows[rows.length - 1].id;
  }
  return { sessions, error: null };
}
