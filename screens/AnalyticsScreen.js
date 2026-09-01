import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,

} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, wp } from '../constants/layout';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import BankrollLineChart from '../components/BankrollLineChart';

export default function AnalyticsScreen({ navigation }) {
  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const insets = useSafeAreaInsets();

  // Dynamic calculations from real history. Recomputed only when
  // sessionHistory actually changes (not on every unrelated context
  // update, e.g. a live hand being logged elsewhere in the app), since
  // this is a full O(n) scan over the whole session list.
  const {
    totalSessions,
    totalHands,
    totalNetProfit,
    totalWins,
    totalLosses,
    totalPushes,
    winRate,
    profitFactor,
    bestSession,
    worstSession,
    avgSessionNet,
    allChronologicalSessions,
    chronologicalSessions,
    maxAbsNet,
    winPercent,
    lossPercent,
    pushPercent,
    games,
  } = useMemo(() => {
    const totalSessions = sessionHistory.length;
    const totalHands = sessionHistory.reduce((sum, s) => sum + (s.totalHands || 0), 0);
    const totalNetProfit = sessionHistory.reduce((sum, s) => sum + (s.netProfit || 0), 0);
    const totalWins = sessionHistory.reduce((sum, s) => sum + (s.wins || 0), 0);
    const totalLosses = sessionHistory.reduce((sum, s) => sum + (s.losses || 0), 0);
    const totalPushes = sessionHistory.reduce((sum, s) => sum + (s.pushes || 0), 0);

    const winRate =
      totalWins + totalLosses > 0
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

    // Real session-by-session data for charts (reversed to chronological order)
    const allChronologicalSessions = [...sessionHistory].reverse();
    const chronologicalSessions = allChronologicalSessions.slice(-7);
    const maxAbsNet = Math.max(
      ...chronologicalSessions.map((s) => Math.abs(s.netProfit)),
      50
    );

    const winPercent = totalHands > 0 ? (totalWins / totalHands) * 100 : 0;
    const lossPercent = totalHands > 0 ? (totalLosses / totalHands) * 100 : 0;
    const pushPercent = totalHands > 0 ? (totalPushes / totalHands) * 100 : 0;

    // Per-game portfolio breakdown
    const games = {
      Blackjack: { sessions: 0, net: 0, totalBets: 0 },
      Poker: { sessions: 0, net: 0, totalBets: 0 },
      'Sports Betting': { sessions: 0, net: 0, totalBets: 0 },
      General: { sessions: 0, net: 0, totalBets: 0 },
    };

    sessionHistory.forEach((session) => {
      const gameType = games[session.gameType] ? session.gameType : 'General';
      games[gameType].sessions += 1;
      games[gameType].net += session.netProfit || 0;

      if (session.mode === 'hands' && Array.isArray(session.hands)) {
        const hands = session.hands.flatMap((r) => (r.type === 'split' && r.hands ? r.hands : [r]));
        games[gameType].totalBets += hands.length;
      } else {
        games[gameType].totalBets += 1;
      }
    });

    return {
      totalSessions,
      totalHands,
      totalNetProfit,
      totalWins,
      totalLosses,
      totalPushes,
      winRate,
      profitFactor,
      bestSession,
      worstSession,
      avgSessionNet,
      allChronologicalSessions,
      chronologicalSessions,
      maxAbsNet,
      winPercent,
      lossPercent,
      pushPercent,
      games,
    };
  }, [sessionHistory]);

  const formatNet = (val) => {
    if (privacyMode) return '••••••';
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    return `${sign}${currencySymbol}${Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const netColor = (val) =>
    val > 0 ? COLORS.success : val < 0 ? COLORS.danger : COLORS.textPrimary;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: insets.bottom + moderateScale(96),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Dynamic session performance metrics</Text>
        </View>

        {/* Top Summary Hero Card */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.cardHeaderLabel}>OVERALL NET PROFIT</Text>
          <Text
            style={[
              styles.heroAmount,
              {
                color:
                  totalNetProfit > 0
                    ? COLORS.success
                    : totalNetProfit < 0
                    ? COLORS.danger
                    : COLORS.textPrimary,
              },
            ]}
          >
            {privacyMode
              ? '••••••'
              : `${totalNetProfit > 0 ? '+' : totalNetProfit < 0 ? '-' : ''}${currencySymbol}${Math.abs(totalNetProfit).toFixed(2)}`}
          </Text>

          <View style={styles.subStatsRow}>
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>Win Rate</Text>
              <Text
                style={[
                  styles.subStatValue,
                  totalSessions > 0 && { color: COLORS.success },
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
            <Ionicons
              name="stats-chart-outline"
              size={moderateScale(28)}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyNoticeTitle}>No Session Data Available</Text>
            <Text style={styles.emptyNoticeText}>
              All metrics on this screen are calculated live from your recorded session history. Start tracking a session to populate analytics.
            </Text>
          </View>
        )}

        {/* Bankroll Over Time */}
        {totalSessions >= 2 && (
          <>
            <Text style={styles.sectionTitle}>Bankroll Over Time</Text>
            <View style={[styles.card, SHADOWS.card]}>
              <BankrollLineChart
                sessions={allChronologicalSessions}
                currencySymbol={currencySymbol}
                privacyMode={privacyMode}
              />
            </View>
          </>
        )}

        {/* Dynamic Session Performance Bars */}
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
                          { color: isPositive ? COLORS.success : COLORS.danger },
                        ]}
                      >
                        {privacyMode
                          ? '••'
                          : `${isPositive ? '+' : '-'}${currencySymbol}${Math.abs(Math.round(session.netProfit))}`}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: `${barHeightPercent}%`,
                              backgroundColor: isPositive
                                ? COLORS.success
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
                  <View
                    style={[
                      styles.distBarSegment,
                      { width: `${winPercent}%`, backgroundColor: COLORS.success },
                    ]}
                  />
                )}
                {lossPercent > 0 && (
                  <View
                    style={[
                      styles.distBarSegment,
                      { width: `${lossPercent}%`, backgroundColor: COLORS.danger },
                    ]}
                  />
                )}
                {pushPercent > 0 && (
                  <View
                    style={[
                      styles.distBarSegment,
                      { width: `${pushPercent}%`, backgroundColor: COLORS.neutral },
                    ]}
                  />
                )}
              </View>

              {/* Legend & Counts */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.legendLabel}>
                    Wins: {totalWins} ({winPercent.toFixed(0)}%)
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                  <Text style={styles.legendLabel}>
                    Losses: {totalLosses} ({lossPercent.toFixed(0)}%)
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.neutral }]} />
                  <Text style={styles.legendLabel}>
                    Pushes: {totalPushes} ({pushPercent.toFixed(0)}%)
                  </Text>
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
                bestSession > 0 && { color: COLORS.success },
              ]}
            >
              {privacyMode
                ? '••••••'
                : `${bestSession > 0 ? '+' : bestSession < 0 ? '-' : ''}${currencySymbol}${Math.abs(bestSession).toFixed(2)}`}
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
              {privacyMode
                ? '••••••'
                : `${worstSession > 0 ? '+' : worstSession < 0 ? '-' : ''}${currencySymbol}${Math.abs(worstSession).toFixed(2)}`}
            </Text>
          </View>

          <View style={[styles.gridCard, SHADOWS.card]}>
            <Text style={styles.gridLabel}>Avg Net / Session</Text>
            <Text
              style={[
                styles.gridValue,
                avgSessionNet > 0
                  ? { color: COLORS.success }
                  : avgSessionNet < 0
                  ? { color: COLORS.danger }
                  : null,
              ]}
            >
              {privacyMode
                ? '••••••'
                : `${avgSessionNet > 0 ? '+' : avgSessionNet < 0 ? '-' : ''}${currencySymbol}${Math.abs(avgSessionNet).toFixed(2)}`}
            </Text>
          </View>

          <View style={[styles.gridCard, SHADOWS.card]}>
            <Text style={styles.gridLabel}>Total Hands Logged</Text>
            <Text style={styles.gridValue}>{totalHands}</Text>
          </View>
        </View>

        {/* Game Portfolio Breakdown */}
        <Text style={styles.sectionTitle}>Game Portfolio Breakdown</Text>
        <View style={[styles.portfolioCard, SHADOWS.card]}>
          {/* Blackjack */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <MaterialCommunityIcons name="cards" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Blackjack</Text>
              <Text style={styles.portfolioSub}>
                {games.Blackjack.sessions} sessions • {games.Blackjack.totalBets} hands
              </Text>
            </View>
            <Text style={[styles.portfolioNet, { color: netColor(games.Blackjack.net) }]}>
              {formatNet(games.Blackjack.net)}
            </Text>
          </View>

          <View style={styles.portfolioDivider} />

          {/* Poker */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <Ionicons name="cash-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Poker</Text>
              <Text style={styles.portfolioSub}>{games.Poker.sessions} sessions logged</Text>
            </View>
            <Text style={[styles.portfolioNet, { color: netColor(games.Poker.net) }]}>
              {formatNet(games.Poker.net)}
            </Text>
          </View>

          <View style={styles.portfolioDivider} />

          {/* Sports Betting */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <Ionicons name="basketball-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Sports Betting</Text>
              <Text style={styles.portfolioSub}>
                {games['Sports Betting'].sessions} slips logged
              </Text>
            </View>
            <Text style={[styles.portfolioNet, { color: netColor(games['Sports Betting'].net) }]}>
              {formatNet(games['Sports Betting'].net)}
            </Text>
          </View>

          <View style={styles.portfolioDivider} />

          {/* General */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <Ionicons name="dice-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>General Tracker</Text>
              <Text style={styles.portfolioSub}>{games.General.sessions} sessions logged</Text>
            </View>
            <Text style={[styles.portfolioNet, { color: netColor(games.General.net) }]}>
              {formatNet(games.General.net)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Behavioral Insights</Text>
          <TouchableOpacity
            style={[styles.card, SHADOWS.card, styles.insightLinkCard]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('LifetimeInsights')}
          >
            <View>
              <Text style={styles.insightLinkTitle}>Lifetime Insights</Text>
              <Text style={styles.insightLinkSubtitle}>Cross-game patterns, streaks, and leak detection</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, SHADOWS.card, styles.insightLinkCard]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Insights', { gameType: 'Blackjack' })}
          >
            <View>
              <Text style={styles.insightLinkTitle}>Blackjack Insights</Text>
              <Text style={styles.insightLinkSubtitle}>Streaks, bet sizing, and patterns</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, SHADOWS.card, styles.insightLinkCard]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PokerInsights')}
          >
            <View>
              <Text style={styles.insightLinkTitle}>Poker Insights</Text>
              <Text style={styles.insightLinkSubtitle}>Bluff-catching, tilt, and leak detection</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, SHADOWS.card, styles.insightLinkCard]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SportsBettingInsights')}
          >
            <View>
              <Text style={styles.insightLinkTitle}>Sports Betting Insights</Text>
              <Text style={styles.insightLinkSubtitle}>Odds edge, favorites vs. dogs, and leak detection</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
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
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
  },
  header: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: fluidFont(26),
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  cardHeaderLabel: {
    fontSize: fluidFont(11),
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroAmount: {
    fontSize: fluidFont(38),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(8),
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
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  subStatValue: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptyNoticeCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  emptyNoticeTitle: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  emptyNoticeText: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: fluidFont(16),
  },
  sectionTitle: {
    fontSize: fluidFont(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: moderateScale(120),
    paddingTop: SPACING.md,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barValueText: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    marginBottom: 6,
  },
  barTrack: {
    width: moderateScale(14),
    height: moderateScale(70),
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: moderateScale(7),
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: moderateScale(7),
  },
  barLabel: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: '600',
  },
  distBarContainer: {
    height: moderateScale(14),
    borderRadius: moderateScale(7),
    backgroundColor: COLORS.backgroundSecondary,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  distBarSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
  },
  legendLabel: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  gridCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gridLabel: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  gridValue: {
    fontSize: fluidFont(17),
    fontWeight: '700',
    color: COLORS.textPrimary,
    
    
  },
  insightLinkCard: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
insightLinkTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
insightLinkSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Game Portfolio Breakdown
  portfolioCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(8),
    paddingHorizontal: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  portfolioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(10),
  },
  portfolioIconBox: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  portfolioInfo: {
    flex: 1,
  },
  portfolioName: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  portfolioSub: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 2,
  },
  portfolioNet: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  portfolioDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: -SPACING.cardPadding + moderateScale(12),
  },
});
