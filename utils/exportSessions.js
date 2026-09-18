// Session export, shared by Profile's "Export data" row and by the crash
// screen. The crash screen is the reason this lives here rather than inside
// ProfileScreen: when the tree has thrown, there is no context to read from,
// so the boundary loads history straight out of storage and hands it here.
import * as Clipboard from 'expo-clipboard';

// expo-file-system and expo-sharing are native modules, so they only exist in
// a binary built after they were added to package.json. Importing them at the
// top of a module makes a dev client built before that throw "Cannot find
// native module 'ExpoSharing'" on every render — so they're required on demand
// instead, and export falls back to the clipboard when they aren't there.
// Rebuilding the app (npx expo run:android / eas build) turns file sharing on.
export const loadFileModules = () => {
  try {
    const fs = require('expo-file-system');
    const sharing = require('expo-sharing');
    if (!fs?.File || !fs?.Paths || !sharing?.shareAsync) return null;
    return { File: fs.File, Paths: fs.Paths, Sharing: sharing };
  } catch {
    return null;
  }
};

// CSV rather than JSON — it opens in Sheets or Excel, which is what people
// actually want this for (their own records, or handing it to an accountant).
export function buildSessionCsv(sessions) {
  const head = [
    'Date',
    'Game',
    'Mode',
    'Duration',
    'Buy-in',
    'Cash-out',
    'Hands/Bets',
    'Wins',
    'Losses',
    'Pushes',
    'Net',
  ];
  const rows = (sessions || []).map((s) => [
    s.rawDate || new Date(s.startTime).toISOString(),
    s.gameType || '',
    s.mode || '',
    s.durationFormatted || '',
    s.buyIn ?? '',
    s.cashOut ?? '',
    s.totalHands ?? 0,
    s.wins ?? 0,
    s.losses ?? 0,
    s.pushes ?? 0,
    // Deliberately not formatNumber: thousands separators would make Excel
    // and Sheets import this column as text instead of numbers.
    (s.netProfit ?? 0).toFixed(2),
  ]);
  const escape = (v) => {
    const str = String(v ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [head, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

// Writes the CSV to a cache file and opens the share sheet, falling back to
// the clipboard when the native modules aren't in this binary. Resolves to a
// `message` the caller shows in its own notice UI — null when the share sheet
// took over and there's nothing left to say.
export async function exportSessionsCsv(sessions) {
  if (!sessions?.length) {
    return { ok: false, message: 'No sessions to export yet.' };
  }

  try {
    const csv = buildSessionCsv(sessions);
    const native = loadFileModules();

    if (native) {
      const stamp = new Date().toISOString().slice(0, 10);
      // expo-file-system v19 (SDK 54) replaced writeAsStringAsync and
      // cacheDirectory with the File/Paths classes; the old helpers moved
      // to `expo-file-system/legacy`.
      const file = new native.File(native.Paths.cache, `ante-sessions-${stamp}.csv`);
      file.create({ overwrite: true });
      file.write(csv);

      if (await native.Sharing.isAvailableAsync()) {
        await native.Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export session history',
          UTI: 'public.comma-separated-values-text',
        });
        return { ok: true, message: null };
      }
    }

    // No native file/share modules in this binary — still give them the data.
    await Clipboard.setStringAsync(csv);
    return {
      ok: true,
      message: native
        ? 'Copied to clipboard.'
        : 'Copied to clipboard — rebuild the app to share a file.',
    };
  } catch (err) {
    console.error('exportSessions: export failed', err);
    return { ok: false, message: 'Export failed. Try again.' };
  }
}
