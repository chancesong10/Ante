import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { useSession } from '../context/SessionContext';

export default function AnalyticsScreen() {
  const { sessionHistory } = useSession();

  // Dynamic calculations from real history
  const totalSessions = sessionHistory.length;
  const totalHands = sessionHistory.reduce((sum, s) => sum + s.totalHands, 0);
  const totalNetProfit = sessionHistory.reduce((sum, s) => sum + s.netProfit, 0);
  const totalWins = sessionHistory.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = sessionHistory.reduce((sum, s) => sum + s.losses, 0);
  const totalPushes = sessionHistory.reduce((sum, s) => sum + s.pushes, 0);

  const winRate =
    (totalWins + totalLosses) > 0
      ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
      : '0.0';

  const totalGrossWins = sessionHistory.reduce((sum, s) => sum + (s.grossWins || 0), 0);
  const totalGrossLosses = sessionHistory.reduce((sum, s) => sum + (s.grossLosses || 0), 0);

  const profitFactor =
    totalGrossLosses > 0
      ? (totalGrossWins / totalGrossLosses).toFixed(2)
      : totalGrossWins > 0
      ? '∞'
      : '0.00';

  const bestSession =
    totalSessions > 0 ? Math.max(...sessionHistory.map((s) => s.netProfit)) : 0;
  const worstSession =
    totalSessions > 0 ? Math.min(...sessionHistory.map((s) => s.netProfit)) : 0;
  const avgSessionNet =
    totalSessions > 0 ? totalNetProfit / totalSessions : 0;

  // Real session-by-session data for chart (reversed to chronological order)
  const chronologicalSessions = [...sessionHistory].reverse().slice(-7);
  const maxAbsNet = Math.max(
    ...chronologicalSessions.map((s) => Math.abs(s.netProfit)),
    50
  );

  const winPercent = totalHands > 0 ? (totalWins / totalHands) * 100 : 0;
  const lossPercent = totalHands > 0 ? (totalLosses / totalHands) * 100 : 0;
  const pushPercent = totalHands > 0 ? (totalPushes / totalHands) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Dynamic session performance metrics</Text>
        </View>

        {/* Top Summary Card */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.cardHeaderLabel}>OVERALL NET PROFIT</Text>
          <Text
            style={[
              styles.heroAmount,
              {
                color:
                  totalNetProfit > 0
                    ? COLORS.primary
                    : totalNetProfit < 0
                    ? COLORS.danger
                    : COLORS.textPrimary,
              },
            ]}
          >
            {totalNetProfit > 0 ? '+' : ''}${totalNetProfit.toFixed(2)}
          </Text>

          <View style={styles.subStatsRow}>
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>Win Rate</Text>
              <Text
                style={[
                  styles.subStatValue,
                  totalSessions > 0 && { color: COLORS.primary },
                ]}
              >
                {winRate}%
              </Text>
            </View>
            <View style={styles.subStatDivider} />
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>Profit Factor</Text>
              <Text style={styles.subStatValue}>{profitFactor}</Text>
            </View>
            <View style={styles.subStatDivider} />
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>Sessions</Text>
              <Text style={styles.subStatValue}>{totalSessions}</Text>
            </View>
          </View>
        </View>

        {/* Empty State Notice when no sessions */}
        {totalSessions === 0 && (
          <View style={styles.emptyNoticeCard}>
            <Ionicons name="stats-chart-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyNoticeTitle}>No Session Data Available</Text>
            <Text style={styles.emptyNoticeText}>
              All metrics on this screen are calculated live from your recorded session history. Start tracking a session to populate analytics.
            </Text>
          </View>
        )}

        {/* Dynamic Session Performance Bars (Only when sessions exist) */}
        {totalSessions > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Session Trajectory</Text>
            <View style={[styles.card, SHADOWS.card]}>
              <View style={styles.chartContainer}>
                {chronologicalSessions.map((session, idx) => {
                  const isPositive = session.netProfit >= 0;
                  const barHeightPercent = Math.max(
                    15,
                    Math.min(100, (Math.abs(session.netProfit) / maxAbsNet) * 100)
                  );

                  return (
                    <View key={session.id || idx} style={styles.barColumn}>
                      <Text
                        style={[
                          styles.barValueText,
                          { color: isPositive ? COLORS.primary : COLORS.danger },
                        ]}
                      >
                        {isPositive ? '+' : ''}${Math.round(session.netProfit)}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${barHeightPercent}%`,
                              backgroundColor: isPositive
                                ? COLORS.primary
                                : COLORS.danger,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>S{idx + 1}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Hand Outcome Distribution */}
            <Text style={styles.sectionTitle}>Hand Outcomes ({totalHands} total)</Text>
            <View style={[styles.card, SHADOWS.card]}>
              {/* Distribution Bar */}
              <View style={styles.distBarContainer}>
                {winPercent > 0 && (
                  <View style={[styles.distBarSegment, { width: `${winPercent}%`, backgroundColor: COLORS.primary }]} />
                )}
                {lossPercent > 0 && (
                  <View style={[styles.distBarSegment, { width: `${lossPercent}%`, backgroundColor: COLORS.danger }]} />
                )}
                {pushPercent > 0 && (
                  <View style={[styles.distBarSegment, { width: `${pushPercent}%`, backgroundColor: '#52525B' }]} />
                )}
              </View>

              {/* Legend & Counts */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.legendLabel}>Wins: {totalWins} ({winPercent.toFixed(0)}%)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                  <Text style={styles.legendLabel}>Losses: {totalLosses} ({lossPercent.toFixed(0)}%)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#52525B' }]} />
                  <Text style={styles.legendLabel}>Pushes: {totalPushes} ({pushPercent.toFixed(0)}%)</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Dynamic Key Performance Indicators Grid */}
        <Text style={styles.sectionTitle}>Detailed Statistics</Text>
        <View style={styles.grid}>
          <View style={[styles.gridCard, SHADOWS.card]}>
            <Text style={styles.gridLabel}>Best Session</Text>
            <Text
              style={[
                styles.gridValue,
                bestSession > 0 && { color: COLORS.primary },
              ]}
            >
              {bestSession > 0 ? '+' : ''}${bestSession.toFixed(2)}
            </Text>
          </View>

          <View style={[styles.gridCard, SHADOWS.card]}>
            <Text style={styles.gridLabel}>Worst Session</Text>
            <Text
              style={[
                styles.gridValue,
                worstSession < 0 && { color: COLORS.danger },
              ]}
            >
              {worstSession > 0 ? '+' : ''}${worstSession.toFixed(2)}
            </Text>
          </View>

          <View style={[styles.gridCard, SHADOWS.card]}>
            <Text style={styles.gridLabel}>Avg Net / Session</Text>
            <Text
              style={[
                styles.gridValue,
                avgSessionNet > 0
                  ? { color: COLORS.primary }
                  : avgSessionNet < 0
                  ? { color: COLORS.danger }
                  : null,
              ]}
            >
              {avgSessionNet > 0 ? '+' : ''}${avgSessionNet.toFixed(2)}
            </Text>
          </View>

          <View style={[styles.gridCard, SHADOWS.card]}>
            <Text style={styles.gridLabel}>Total Hands Logged</Text>
            <Text style={styles.gridValue}>{totalHands}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
  },
  subStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  subStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  subStatDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 2,
  },
  subStatLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  subStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptyNoticeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  emptyNoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  emptyNoticeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 16,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barValueText: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
  },
  barTrack: {
    width: 14,
    height: 70,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: '600',
  },
  distBarContainer: {
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.backgroundSecondary,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  distBarSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  gridCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gridLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  gridValue: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
});
