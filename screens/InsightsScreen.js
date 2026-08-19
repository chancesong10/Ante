import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import { computeInsights } from '../utils/statsEngine';

function StatLine({ label, value, valueColor }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={[styles.statRowValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function InsightsScreen({ route, navigation }) {
  const { gameType } = route.params;
  const { sessionHistory } = useSession();
  const insets = useSafeAreaInsets();

  const stats = computeInsights(sessionHistory, gameType);
  const hasEnoughData = stats.totalHands >= 5;

  const streakColor =
    stats.currentStreakType === 'win'
      ? COLORS.success
      : stats.currentStreakType === 'loss'
      ? COLORS.danger
      : COLORS.textPrimary;

  const betSizeDelta = stats.avgBetAfterLoss - stats.avgBetAfterWin;
  const chasesLosses = betSizeDelta > 0 && stats.sampleAfterLoss >= 3;

  const cwr = stats.conditionalWinRates;
  const dbl = stats.doublingStats;
  const bj = stats.blackjackFrequency;
  const tiers = stats.betTierWinRates;
  const vol = stats.volatility;
  const dow = stats.dayOfWeekPerformance;
  const lenPerf = stats.sessionLengthPerformance;

  const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
  const fmtMoney = (v) => `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topNav}>
        <Ionicons
          name="chevron-back"
          size={22}
          color={COLORS.textPrimary}
          onPress={() => navigation.goBack()}
          style={styles.backIcon}
        />
        <Text style={styles.navTitle}>{gameType} Insights</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + moderateScale(60) }]}
        showsVerticalScrollIndicator={false}
      >
        {!hasEnoughData ? (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Not Enough Data Yet</Text>
            <Text style={styles.emptyText}>
              Log at least 5 {gameType} hands to unlock behavioral insights. Right now you have {stats.totalHands}.
            </Text>
          </View>
        ) : (
          <>
            {/* Current Streak */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>CURRENT STREAK</Text>
              <Text style={[styles.streakValue, { color: streakColor }]}>
                {stats.currentStreakType
                  ? `${stats.currentStreakLength} ${stats.currentStreakType === 'win' ? 'Win' : 'Loss'}${stats.currentStreakLength !== 1 ? 's' : ''}`
                  : 'None'}
              </Text>
            </View>

            <View style={styles.rowCards}>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <View style={styles.halfCardHeader}>
                  <Text style={styles.cardLabel}>LONGEST WIN STREAK</Text>
                </View>
                <Text style={[styles.halfValue, { color: COLORS.success }]}>{stats.longestWinStreak}</Text>
              </View>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <View style={styles.halfCardHeader}>
                  <Text style={styles.cardLabel}>LONGEST LOSS STREAK</Text>
                </View>
                <Text style={[styles.halfValue, { color: COLORS.danger }]}>{stats.longestLossStreak}</Text>
              </View>
            </View>

            {/* Conditional Win Rates */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>CONDITIONAL WIN RATE</Text>
              <Text style={styles.cardHint}>Your win rate depending on what just happened</Text>
              <StatLine label={`After a Win (n=${cwr.afterWin.sample})`} value={fmtPct(cwr.afterWin.rate)} />
              <StatLine label={`After a Loss (n=${cwr.afterLoss.sample})`} value={fmtPct(cwr.afterLoss.rate)} />
              <StatLine label={`After 2 Wins (n=${cwr.afterTwoWins.sample})`} value={fmtPct(cwr.afterTwoWins.rate)} />
              <StatLine label={`After 2 Losses (n=${cwr.afterTwoLosses.sample})`} value={fmtPct(cwr.afterTwoLosses.rate)} />
              {cwr.afterWin.rate !== null && cwr.afterLoss.rate !== null && (
                <View style={styles.insightNote}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.insightNoteText}>
                    {Math.abs(cwr.afterWin.rate - cwr.afterLoss.rate) < 5
                      ? "Your results don't show a meaningful streak pattern — each hand appears close to independent, as expected."
                      : `Your win rate shifts by ${Math.abs(cwr.afterWin.rate - cwr.afterLoss.rate).toFixed(1)} points depending on the previous outcome.`}
                  </Text>
                </View>
              )}
            </View>

            {/* Doubling Performance */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>DOUBLING PERFORMANCE</Text>
              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareColLabel}>Doubled (n={dbl.doubled.sample})</Text>
                  <Text style={styles.compareColValue}>{fmtPct(dbl.doubled.winRate)}</Text>
                  <Text style={styles.compareColSub}>
                    ROI: {dbl.doubled.roi !== null ? `${dbl.doubled.roi.toFixed(1)}%` : '—'}
                  </Text>
                </View>
                <View style={styles.compareCol}>
                  <Text style={styles.compareColLabel}>Not Doubled (n={dbl.notDoubled.sample})</Text>
                  <Text style={styles.compareColValue}>{fmtPct(dbl.notDoubled.winRate)}</Text>
                  <Text style={styles.compareColSub}>
                    ROI: {dbl.notDoubled.roi !== null ? `${dbl.notDoubled.roi.toFixed(1)}%` : '—'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Blackjack Frequency */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>NATURAL BLACKJACK RATE</Text>
              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareColLabel}>Your Rate</Text>
                  <Text style={styles.compareColValue}>{bj.actualRate.toFixed(1)}%</Text>
                </View>
                <View style={styles.compareCol}>
                  <Text style={styles.compareColLabel}>Expected</Text>
                  <Text style={styles.compareColValue}>~{bj.expectedRate}%</Text>
                </View>
              </View>
              <Text style={styles.cardFootnote}>{bj.count} blackjacks out of {bj.sample} hands</Text>
            </View>

            {/* Bet-Size Tier Win Rates */}
            {tiers && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>WIN RATE BY BET SIZE</Text>
                <Text style={styles.cardHint}>Based on your own small / medium / large bet ranges</Text>
                <StatLine
                  label={`Small (avg $${tiers.small.avgBet.toFixed(0)}, n=${tiers.small.sample})`}
                  value={fmtPct(tiers.small.winRate)}
                />
                <StatLine
                  label={`Medium (avg $${tiers.medium.avgBet.toFixed(0)}, n=${tiers.medium.sample})`}
                  value={fmtPct(tiers.medium.winRate)}
                />
                <StatLine
                  label={`Large (avg $${tiers.large.avgBet.toFixed(0)}, n=${tiers.large.sample})`}
                  value={fmtPct(tiers.large.winRate)}
                />
              </View>
            )}

            {/* Volatility */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>RISK & VOLATILITY</Text>
              <StatLine label="Net Result Std. Deviation" value={`$${vol.netResultStdDev.toFixed(2)}`} />
              <StatLine label="Bet Size Std. Deviation" value={`$${vol.betSizeStdDev.toFixed(2)}`} />
              <StatLine
                label="Bet Sizing Consistency"
                value={vol.betSizeConsistency !== null ? `${vol.betSizeConsistency.toFixed(0)}/100` : '—'}
              />
              <Text style={styles.cardFootnote}>
                Higher net result deviation means more volatile swings; higher consistency means steadier bet sizing.
              </Text>
            </View>

            {/* Bet Size After Outcome */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>BET SIZE AFTER OUTCOME</Text>
              <StatLine label="After a Win" value={`$${stats.avgBetAfterWin.toFixed(2)}`} />
              <StatLine label="After a Loss" value={`$${stats.avgBetAfterLoss.toFixed(2)}`} />
              {chasesLosses && (
                <View style={styles.insightNote}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.insightNoteText}>
                    You tend to bet {((betSizeDelta / (stats.avgBetAfterWin || 1)) * 100).toFixed(0)}% more after a loss than after a win.
                  </Text>
                </View>
              )}
            </View>

            {/* Day of Week */}
            {dow && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>BEST & WORST DAYS</Text>
                <StatLine
                  label={`Best: ${dow.best.day} (${dow.best.sessions} session${dow.best.sessions !== 1 ? 's' : ''})`}
                  value={fmtMoney(dow.best.avgNet)}
                  valueColor={COLORS.success}
                />
                <StatLine
                  label={`Worst: ${dow.worst.day} (${dow.worst.sessions} session${dow.worst.sessions !== 1 ? 's' : ''})`}
                  value={fmtMoney(dow.worst.avgNet)}
                  valueColor={COLORS.danger}
                />
                <Text style={styles.cardFootnote}>Average net profit per session on each day</Text>
              </View>
            )}

            {/* Session Length Performance */}
            {lenPerf && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>PERFORMANCE BY SESSION LENGTH</Text>
                <StatLine
                  label={`Short: ≤10 hands (n=${lenPerf.short.sample})`}
                  value={lenPerf.short.avgNetPerHand !== null ? `${fmtMoney(lenPerf.short.avgNetPerHand)}/hand` : '—'}
                />
                <StatLine
                  label={`Medium: 11–25 hands (n=${lenPerf.medium.sample})`}
                  value={lenPerf.medium.avgNetPerHand !== null ? `${fmtMoney(lenPerf.medium.avgNetPerHand)}/hand` : '—'}
                />
                <StatLine
                  label={`Large: 25+ hands (n=${lenPerf.long.sample})`}
                  value={lenPerf.long.avgNetPerHand !== null ? `${fmtMoney(lenPerf.long.avgNetPerHand)}/hand` : '—'}
                />
                <Text style={styles.cardFootnote}>
                  If longer sessions trend worse, that can be a fatigue or tilt signal worth watching.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backIcon: { padding: 4 },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: 16 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 10 },
  emptyText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 14,
  },
  cardLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 4 },
  cardHint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 10 },
  cardFootnote: { fontSize: 11, color: COLORS.textMuted, marginTop: 8, lineHeight: 15 },
  streakValue: { fontSize: 28, fontWeight: '900' },
  rowCards: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  halfCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'space-between',
    minHeight: 100,
  },
  halfCardHeader: {
    minHeight: 34,
    justifyContent: 'flex-start',
  },
  halfValue: { fontSize: 24, fontWeight: '900' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statRowLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', flex: 1, marginRight: 8 },
  statRowValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '800' },
  compareRow: { flexDirection: 'row', gap: 10 },
  compareCol: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  compareColLabel: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginBottom: 4 },
  compareColValue: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
  compareColSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  insightNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  insightNoteText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 16 },
});