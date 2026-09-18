import { supabase } from './supabaseClient';

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
  const rows = sessions.map((s) => toRow(userId, s));
  const { error } = await supabase.from('sessions').upsert(rows, { onConflict: 'id' });
  if (error) console.error('syncService: failed to push sessions', error);
  return { error };
}

export async function deleteCloudSessions(userId, sessionIds) {
  if (!userId || !sessionIds?.length) return { error: null };
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('user_id', userId)
    .in('id', sessionIds);
  if (error) console.error('syncService: failed to delete cloud sessions', error);
  return { error };
}

export async function pullSessions(userId) {
  if (!userId) return { sessions: [], error: null };
  const { data, error } = await supabase
    .from('sessions')
    .select('data')
    .eq('user_id', userId)
    .order('start_time', { ascending: false });
  if (error) {
    console.error('syncService: failed to pull sessions', error);
    return { sessions: [], error };
  }
  return { sessions: (data || []).map((row) => row.data), error: null };
}
