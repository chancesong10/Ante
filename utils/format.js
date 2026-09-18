// Pure formatting helpers shared across every screen — no React, no UI.
// These were re-implemented (slightly differently) in most screens; this is
// the single source of truth.
import { COLORS } from '../constants/theme';

const DAY_MS = 86400000;

// Result colour: green for profit, red for loss, neutral ink for break-even.
//
// Goes neutral under privacy mode. Masking the figure while still painting the
// row green or red leaks the half of it that usually matters — someone reading
// over your shoulder does not need the number to see that you are down.
export const netTone = (value, privacyMode = false) =>
  privacyMode
    ? COLORS.textPrimary
    : value > 0
    ? COLORS.success
    : value < 0
    ? COLORS.danger
    : COLORS.textPrimary;

// Money for display. `signed` adds a +/− for deltas and results; turn it off
// for standalone figures. Privacy mode collapses to a fixed-width mask so the
// layout never jumps between hidden and shown.
export const formatMoney = (
  value,
  currencySymbol = '$',
  privacyMode = false,
  { signed = true } = {}
) => {
  if (privacyMode) return '••••';
  const n = Number(value) || 0;
  const sign = signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : '';
  return `${sign}${currencySymbol}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// A number with thousands separators at a fixed precision, for amounts where
// the caller renders the currency symbol and sign itself.
export const formatNumber = (value, decimals = 2) =>
  (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// An amount as a player entered it — a bet, a chip, a blind: whole amounts
// stay whole ("1,000") and anything with cents keeps two places ("12.50").
export const formatAmount = (value) => {
  const n = Number(value) || 0;
  return formatNumber(n, Math.abs(n - Math.round(n)) < 0.005 ? 0 : 2);
};

// Hex (#RRGGBB) → rgba() so a solid accent can be used as a translucent tint.
// Passes non-hex values through untouched.
export const hexToRgba = (hex, alpha) => {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Short relative time for recency — minutes and hours, where relativeDay's
// day granularity would round everything recent to 'Today'. Used by the sync
// status row, where 'synced 2m ago' and 'synced this morning' mean different
// things to someone checking whether their data actually left the device.
export const relativeTime = (timestamp) => {
  if (!timestamp) return '';
  const mins = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return relativeDay(timestamp, 'a while ago');
};

// Short relative date ("Today" / "Yesterday" / "3d ago" / "2w ago"). Built
// from arithmetic rather than Intl, which Hermes covers unevenly. Falls back
// to the caller's preformatted string past a year, or when startTime is absent.
export const relativeDay = (startTime, fallback = '') => {
  if (!startTime) return fallback;
  const now = new Date();
  const then = new Date(startTime);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfThen) / DAY_MS);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return fallback || `${Math.floor(diffDays / 365)}y ago`;
};
