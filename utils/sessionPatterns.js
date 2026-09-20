// Session-level patterns — the calculations that read a list of completed
// sessions rather than a list of hands. No React, no UI.
//
// These lived in two places: statsEngine.js computed them per game, and
// lifetimeInsightsEngine.js computed them across every game, from its own
// near-verbatim copy. The copies had already drifted — the lifetime versions
// added `|| 0` guards the per-game ones never got — and that drift is what
// this file exists to stop. Everything here takes a plain `sessions` array,
// so the caller decides the scope and the arithmetic only has to be right
// once.
//
// The guarded versions are the ones kept: on well-formed data they agree with
// the unguarded originals exactly, and on a record missing a field they
// produce 0 rather than NaN.

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Sample standard deviation. Three engines had their own identical copy.
export function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// A session Ante can honestly measure a duration for. Sessions missing a
// start or end, or with an end at or before the start, are excluded rather
// than counted as zero-length — counting them would push any per-hour figure
// toward infinity.
export function hasSaneDuration(session) {
  return (
    session.startTime != null && session.endTime != null && session.endTime > session.startTime
  );
}

// Hours played and the result per hour, over whichever sessions are handed in.
//
// The scope is the caller's to choose, and getting it wrong is not obvious
// from the number: a poker screen that passes its whole history rather than
// its poker sessions shows a figure that looks plausible and is measuring
// something else entirely. Pass the same sessions the rest of the screen is
// about.
//
// Below a few minutes the divisor is noise, so `hourlyRate` reports null
// rather than "+$4,182/hr" off one lucky two-minute session. `totalHours` is
// still returned, so a caller with its own numerator (bb/hour, say) can apply
// the same threshold instead of inventing a second one.
export const MIN_HOURS_FOR_RATE = 0.25;

export function calcHourlyRate(sessions) {
  let ms = 0;
  let net = 0;
  let sample = 0;

  sessions.forEach((s) => {
    if (!hasSaneDuration(s)) return;
    ms += s.endTime - s.startTime;
    net += s.netProfit || 0;
    sample += 1;
  });

  const totalHours = ms / 3600000;
  return {
    totalHours,
    sample,
    hourlyRate: totalHours >= MIN_HOURS_FOR_RATE ? net / totalHours : null,
  };
}

// Which days you come out ahead on, and which you don't.
//
// Needs at least 2 distinct days with data — otherwise "best" and "worst"
// would be the same single day, which is confusing, not insightful.
export function calcDayOfWeekPerformance(sessions) {
  const byDay = {};
  DAY_NAMES.forEach((d) => (byDay[d] = { netProfit: 0, sessions: 0 }));

  sessions.forEach((s) => {
    const day = DAY_NAMES[new Date(s.startTime).getDay()];
    byDay[day].netProfit += s.netProfit || 0;
    byDay[day].sessions += 1;
  });

  const withData = Object.entries(byDay)
    .filter(([, v]) => v.sessions > 0)
    .map(([day, v]) => ({ day, avgNet: v.netProfit / v.sessions, sessions: v.sessions }));

  if (withData.length < 2) return null;

  const best = withData.reduce((a, b) => (b.avgNet > a.avgNet ? b : a));
  const worst = withData.reduce((a, b) => (b.avgNet < a.avgNet ? b : a));

  return { best, worst, allDays: withData };
}

// Whether judgment holds up over a long session. Tiers are hand counts
// rather than clock time, since that is what the trackers record per session
// on both sides of the buy-in/hands split.
export function calcSessionLengthPerformance(sessions) {
  if (sessions.length < 3) return null;

  const tiers = { short: [], medium: [], long: [] };
  sessions.forEach((s) => {
    const totalHands = s.totalHands || 0;
    if (totalHands <= 10) tiers.short.push(s);
    else if (totalHands <= 25) tiers.medium.push(s);
    else tiers.long.push(s);
  });

  const summarize = (arr) => ({
    sample: arr.length,
    avgNetPerHand:
      arr.length > 0
        ? arr.reduce((sum, s) => sum + (s.netProfit || 0) / (s.totalHands || 1), 0) / arr.length
        : null,
  });

  return {
    short: summarize(tiers.short),
    medium: summarize(tiers.medium),
    long: summarize(tiers.long),
  };
}
