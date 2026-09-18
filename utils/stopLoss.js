// Pure stop-loss alert logic — no React, no UI.

// The tier a session's losses have reached against the configured threshold:
// 0 below it, 1 at one threshold, 2 at twice, and so on.
//
// Tiering is the whole reason the alert can't be swiped away and forgotten.
// Acknowledging records the tier reached at that moment, so the warning stays
// quiet until losses deepen past the *next* multiple — rather than re-firing
// on every hand (which trains the user to dismiss it reflexively) or going
// silent for good (which is what they'd get from a plain "don't show again").
export function lossTier(netOutcome, threshold) {
  if (!Number.isFinite(netOutcome) || !Number.isFinite(threshold) || threshold <= 0) return 0;
  const netLoss = -netOutcome;
  if (netLoss < threshold) return 0;
  return Math.floor(netLoss / threshold);
}

// Whether a running session has crossed into a tier deeper than the one
// already acknowledged on it.
//
// `alertedTier` is read off the session record rather than from app state so
// an acknowledgement survives the process dying: an OS memory kill is
// indistinguishable from a force quit, and a session restored mid-evening
// would otherwise re-raise a warning the user dismissed minutes earlier.
export function shouldRaiseStopLossAlert(session, metrics, { enabled, threshold } = {}) {
  if (!enabled || !Number.isFinite(threshold) || threshold <= 0) return false;
  const tier = lossTier(metrics?.netOutcome ?? 0, threshold);
  return tier > (session?.alertedTier || 0);
}

// The tier to record when the user acknowledges an alert on this session.
export function acknowledgedTier(netOutcome, threshold) {
  return lossTier(netOutcome, threshold);
}
