import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

// Live session figures shared by the roulette and baccarat trackers. Both
// take a summary from calcSessionSummary (utils/tableGameStatsEngine).

// Whole amounts stay whole ("$25"); anything with cents keeps them.
const amount = (v) => (Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(2));
const signed = (v, symbol) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${symbol}${Math.abs(v).toFixed(2)}`;
const signedWhole = (v, symbol) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${symbol}${Math.abs(v).toFixed(0)}`;
const toneOf = (v) => (v > 0 ? COLORS.success : v < 0 ? COLORS.danger : COLORS.textPrimary);

// Sits under the net outcome: money across the felt, the typical bet, the best
// single result, and what the house edge expected from all of it. Shown from
// the moment the tracker opens, at zero, so the figures are already in place
// when the first bet lands instead of popping in underneath it.
export function SessionMoneyStrip({ summary, currencySymbol = '$', bestLabel = 'Best' }) {
  if (!summary) return null;
  // No priced bets yet (summary.expected is null) reads as a flat $0.00.
  const exp = summary.expected || { expectedNetMin: 0, expectedNetMax: 0, luckMin: 0, luckMax: 0, isRange: false };
  const span = (min, max) =>
    exp.isRange ? `${signedWhole(min, currencySymbol)} to ${signedWhole(max, currencySymbol)}` : signed(max, currencySymbol);
  const luckTone = exp.luckMin > 0 ? COLORS.success : exp.luckMax < 0 ? COLORS.danger : COLORS.textPrimary;

  return (
    <View style={styles.strip}>
      <View style={styles.pillRow}>
        <Pill label="Wagered" value={`${currencySymbol}${amount(summary.totalWagered)}`} />
        <Pill label="Avg Bet" value={`${currencySymbol}${amount(summary.avgBet)}`} />
        <Pill
          label={bestLabel}
          value={summary.biggestWin > 0 ? `+${currencySymbol}${amount(summary.biggestWin)}` : `${currencySymbol}0`}
          color={summary.biggestWin > 0 ? COLORS.success : undefined}
        />
      </View>
      <Text style={styles.expectedText}>
        House edge expects <Text style={styles.expectedStrong}>{span(exp.expectedNetMin, exp.expectedNetMax)}</Text>
        {'   ·   '}
        Luck <Text style={[styles.expectedStrong, { color: luckTone }]}>{span(exp.luckMin, exp.luckMax)}</Text>
      </Text>
    </View>
  );
}

function Pill({ label, value, color }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, color && { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

// Where this session's money went, one row per bet type (roulette) or side
// (baccarat), biggest share first. Like the strip above, it's there before
// anything is logged.
export function SessionMixCard({ summary, currencySymbol = '$', title, unit }) {
  if (!summary) return null;
  return (
    <View style={[styles.card, SHADOWS.card]}>
      <View style={styles.cardHeader}>
        <Ionicons name="pie-chart-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {summary.mix.length === 0 && (
        <Text style={styles.mixEmpty}>
          No {unit}s logged yet. Each bet shows up here with its share of the action.
        </Text>
      )}
      {summary.mix.map((m, i) => (
        <View key={m.label} style={[styles.mixRow, i > 0 && styles.mixRowDivider]}>
          <View style={styles.mixTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mixLabel}>{m.label}</Text>
              <Text style={styles.mixSub}>
                {m.count} {m.count === 1 ? unit : `${unit}s`} · {currencySymbol}
                {amount(m.wagered)}
                {m.shareOfWagered !== null ? ` · ${m.shareOfWagered.toFixed(0)}% of action` : ''}
              </Text>
            </View>
            <Text style={[styles.mixNet, { color: toneOf(m.net) }]}>{signed(m.net, currencySymbol)}</Text>
          </View>
          {m.shareOfWagered !== null && (
            <View style={styles.shareTrack}>
              <View style={[styles.shareFill, { width: `${Math.max(2, Math.min(100, m.shareOfWagered))}%` }]} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { width: '100%', marginTop: 8 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  pillLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', fontWeight: '600' },
  pillValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  expectedText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  expectedStrong: { color: COLORS.textPrimary, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  mixEmpty: { fontSize: 12, color: COLORS.textMuted, paddingVertical: 6, lineHeight: 17 },
  mixRow: { paddingVertical: 10 },
  mixRowDivider: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  mixTop: { flexDirection: 'row', alignItems: 'center' },
  mixLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  mixSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  mixNet: { fontSize: 14, fontWeight: '700', marginLeft: 8, fontVariant: ['tabular-nums'] },
  shareTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    marginTop: 8,
    overflow: 'hidden',
  },
  shareFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.textMuted },
});
