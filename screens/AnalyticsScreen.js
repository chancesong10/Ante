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
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, wp } from '../constants/layout';
import { useVisibleSessionHistory, useCloudRefresh } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import BankrollLineChart from '../components/BankrollLineChart';
import { GameIconTile } from '../components/GameIcon';
import CountUp from '../components/CountUp';
import usePullToRefresh from '../components/usePullToRefresh';

// Trajectory chart geometry. Each half is a fixed band; inside it a strip is
// reserved for the value label so a full-height bar can never push its own
// number out of the band and into the date row underneath. Bars scale to
// TRAJ_PLOT uniformly — shortening only the labelled ones would make the
// chart lie about their relative size.
const TRAJ_LABEL = moderateScale(20);
const TRAJ_HALF = moderateScale(64);
const TRAJ_PLOT = TRAJ_HALF - TRAJ_LABEL;

export default function AnalyticsScreen({ navigation }) {
  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const insets = useSafeAreaInsets();
  const refreshControl = usePullToRefresh();

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
    bestIdx,
    worstIdx,
    winPercent,
    lossPercent,
    pushPercent,
    games,
    hourlyRate,
    totalHours,
    thisMonth,
    lastMonth,
    monthLabel,
    lastMonthLabel,
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

    // Which of the visible sessions to label — only the extremes get a number.
    let bestIdx = -1;
    let worstIdx = -1;
    chronologicalSessions.forEach((s2, i) => {
      const n = s2.netProfit || 0;
      if (bestIdx === -1 || n > (chronologicalSessions[bestIdx].netProfit || 0)) bestIdx = i;
      if (worstIdx === -1 || n < (chronologicalSessions[worstIdx].netProfit || 0)) worstIdx = i;
    });

    const winPercent = totalHands > 0 ? (totalWins / totalHands) * 100 : 0;
    const lossPercent = totalHands > 0 ? (totalLosses / totalHands) * 100 : 0;
    const pushPercent = totalHands > 0 ? (totalPushes / totalHands) * 100 : 0;

    // --- Hourly rate. The one figure that turns "down $400" into something
    // comparable to a wage, which is usually the more uncomfortable number.
    // Sessions missing a sane start/end pair are excluded rather than counted
    // as zero-length, which would inflate the rate toward infinity.
    const timed = sessionHistory.filter(
      (s) => s.startTime != null && s.endTime != null && s.endTime > s.startTime
    );
    const totalMs = timed.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
    const totalHours = totalMs / 3600000;
    const timedNet = timed.reduce((sum, s) => sum + (s.netProfit || 0), 0);
    // Below a few minutes the divisor is noise, so report nothing rather than
    // "+$4,182/hr" off one lucky two-minute session.
    const hourlyRate = totalHours >= 0.25 ? timedNet / totalHours : null;

    // --- This calendar month vs last. Calendar months rather than rolling
    // 30-day windows because that's the unit people actually think in when
    // they ask "how did I do this month".
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    const summarisePeriod = (from, to) => {
      const inPeriod = sessionHistory.filter((s) => s.startTime >= from && s.startTime < to);
      const net = inPeriod.reduce((sum, s) => sum + (s.netProfit || 0), 0);
      const wins = inPeriod.reduce((sum, s) => sum + (s.wins || 0), 0);
      const losses = inPeriod.reduce((sum, s) => sum + (s.losses || 0), 0);
      return {
        sessions: inPeriod.length,
        net,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null,
      };
    };

    const thisMonth = summarisePeriod(thisMonthStart, Infinity);
    const lastMonth = summarisePeriod(lastMonthStart, thisMonthStart);
    const monthLabel = now.toLocaleDateString(undefined, { month: 'long' });
    const lastMonthLabel = new Date(lastMonthStart).toLocaleDateString(undefined, {
      month: 'long',
    });

    // Per-game portfolio breakdown
    const games = {
      Blackjack: { sessions: 0, net: 0, totalBets: 0 },
      Poker: { sessions: 0, net: 0, totalBets: 0 },
      'Sports Betting': { sessions: 0, net: 0, totalBets: 0 },
      Roulette: { sessions: 0, net: 0, totalBets: 0 },
      Baccarat: { sessions: 0, net: 0, totalBets: 0 },
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
      bestIdx,
      worstIdx,
      winPercent,
      lossPercent,
      pushPercent,
      games,
      hourlyRate,
      totalHours,
      thisMonth,
      lastMonth,
      monthLabel,
      lastMonthLabel,
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
        refreshControl={refreshControl}
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
          <CountUp
            value={totalNetProfit}
            format={formatNet}
            animate={!privacyMode}
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
          />

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
            {/* The chart sits directly under the headline net, so the number
                and the shape that produced it are read as one thing. */}
            <Text style={styles.sectionTitle}>Bankroll Over Time</Text>
            <View style={[styles.card, SHADOWS.card]}>
              <BankrollLineChart
                sessions={allChronologicalSessions}
                currencySymbol={currencySymbol}
                privacyMode={privacyMode}
              />
            </View>

            {/* This month vs last — the comparison people actually ask for,
                on calendar months rather than a rolling window. */}
            <Text style={styles.sectionTitle}>This Month vs Last</Text>
            <View style={[styles.card, SHADOWS.card, styles.monthCard]}>
              <View style={styles.monthRow}>
                <View style={styles.monthCol}>
                  <Text style={styles.monthLabel}>{monthLabel.toUpperCase()}</Text>
                  <CountUp
                    value={thisMonth.net}
                    format={formatNet}
                    animate={!privacyMode}
                    style={[styles.monthNet, { color: netColor(thisMonth.net) }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                  <Text style={styles.monthMeta}>
                    {thisMonth.sessions} session{thisMonth.sessions === 1 ? '' : 's'}
                    {thisMonth.winRate !== null ? ` · ${thisMonth.winRate.toFixed(0)}% win` : ''}
                  </Text>
                </View>

                <View style={styles.monthDivider} />

                <View style={styles.monthCol}>
                  <Text style={styles.monthLabel}>{lastMonthLabel.toUpperCase()}</Text>
                  <Text
                    style={[styles.monthNet, styles.monthNetPast]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatNet(lastMonth.net)}
                  </Text>
                  <Text style={styles.monthMeta}>
                    {lastMonth.sessions} session{lastMonth.sessions === 1 ? '' : 's'}
                    {lastMonth.winRate !== null ? ` · ${lastMonth.winRate.toFixed(0)}% win` : ''}
                  </Text>
                </View>
              </View>

              {lastMonth.sessions > 0 && (
                <View style={styles.monthDeltaRow}>
                  <Ionicons
                    name={thisMonth.net >= lastMonth.net ? 'trending-up' : 'trending-down'}
                    size={moderateScale(14)}
                    color={thisMonth.net >= lastMonth.net ? COLORS.success : COLORS.danger}
                  />
                  <Text style={styles.monthDeltaText}>
                    {privacyMode
                      ? '••••'
                      : `${formatNet(thisMonth.net - lastMonth.net)} vs ${lastMonthLabel}`}
                  </Text>
                </View>
              )}
            </View>

          </>
        )}

        {/* Dynamic Session Performance Bars */}
        {totalSessions > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Session Trajectory</Text>
            <View style={[styles.card, SHADOWS.card]}>
              {/* Diverging around a zero line: wins rise, losses drop. The old
                  version drew |net| upward from a shared baseline, so a -$300
                  session and a +$300 one were the same bar in a different
                  colour — the shape carried no information the colour didn't
                  already. Bar length is proportional to the window's largest
                  swing, with no minimum stub, so a break-even session reads as
                  flat rather than as a small win. */}
              <View style={styles.trajChart}>
                <View style={styles.trajZeroLine} />
                <View style={styles.trajRow}>
                  {chronologicalSessions.map((session, idx) => {
                    const net = session.netProfit || 0;
                    const isPositive = net >= 0;
                    // Only the extremes get a number — seven labels at this
                    // size is a wall of digits, and the bars already rank them.
                    const isExtreme = idx === bestIdx || idx === worstIdx;
                    const barHeight =
                      net === 0 ? 0 : Math.max(3, (Math.abs(net) / maxAbsNet) * TRAJ_PLOT);

                    return (
                      <View key={session.id || idx} style={styles.trajCol}>
                        <View style={styles.trajHalfTop}>
                          {isExtreme && isPositive && net !== 0 && (
                            <Text style={[styles.trajValue, { color: COLORS.success }]}>
                              {privacyMode
                                ? '••'
                                : `+${currencySymbol}${Math.abs(Math.round(net))}`}
                            </Text>
                          )}
                          {isPositive && (
                            <View
                              style={[
                                styles.trajBar,
                                styles.trajBarUp,
                                { height: barHeight, backgroundColor: COLORS.success },
                              ]}
                            />
                          )}
                        </View>

                        <View style={styles.trajHalfBottom}>
                          {!isPositive && (
                            <View
                              style={[
                                styles.trajBar,
                                styles.trajBarDown,
                                { height: barHeight, backgroundColor: COLORS.danger },
                              ]}
                            />
                          )}
                          {isExtreme && !isPositive && (
                            <Text style={[styles.trajValue, { color: COLORS.danger }]}>
                              {privacyMode
                                ? '••'
                                : `-${currencySymbol}${Math.abs(Math.round(net))}`}
                            </Text>
                          )}
                        </View>

                        <Text style={styles.trajLabel} numberOfLines={1}>
                          {session.startTime
                            ? new Date(session.startTime).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
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
          {/* Net per hour actually at the table — the figure that makes a
              bankroll comparable to a wage. */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <Text style={styles.gridLabel}>Net Per Hour</Text>
            {hourlyRate === null ? (
              <Text style={[styles.gridValue, { color: COLORS.textMuted }]}>—</Text>
            ) : (
              <CountUp
                value={hourlyRate}
                format={(v) => `${formatNet(v)}`}
                animate={!privacyMode}
                style={[styles.gridValue, { color: netColor(hourlyRate) }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            )}
            <Text style={styles.gridSub}>
              {hourlyRate === null
                ? 'Not enough tracked time yet'
                : `Across ${totalHours.toFixed(1)}h played`}
            </Text>
          </View>

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
            <GameIconTile gameType="Blackjack" glyph={moderateScale(18)} style={styles.portfolioIconBox} />
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
            <GameIconTile gameType="Poker" glyph={moderateScale(18)} style={styles.portfolioIconBox} />
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
            <GameIconTile gameType="Sports Betting" glyph={moderateScale(18)} style={styles.portfolioIconBox} />
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

          {/* Roulette */}
          <View style={styles.portfolioRow}>
            <GameIconTile gameType="Roulette" glyph={moderateScale(18)} style={styles.portfolioIconBox} />
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Roulette</Text>
              <Text style={styles.portfolioSub}>
                {games.Roulette.sessions} sessions • {games.Roulette.totalBets} spins
              </Text>
            </View>
            <Text style={[styles.portfolioNet, { color: netColor(games.Roulette.net) }]}>
              {formatNet(games.Roulette.net)}
            </Text>
          </View>

          <View style={styles.portfolioDivider} />

          {/* Baccarat */}
          <View style={styles.portfolioRow}>
            <GameIconTile gameType="Baccarat" glyph={moderateScale(18)} style={styles.portfolioIconBox} />
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Baccarat</Text>
              <Text style={styles.portfolioSub}>
                {games.Baccarat.sessions} sessions • {games.Baccarat.totalBets} hands
              </Text>
            </View>
            <Text style={[styles.portfolioNet, { color: netColor(games.Baccarat.net) }]}>
              {formatNet(games.Baccarat.net)}
            </Text>
          </View>

          <View style={styles.portfolioDivider} />

          {/* General */}
          <View style={styles.portfolioRow}>
            <GameIconTile gameType="General" glyph={moderateScale(18)} style={styles.portfolioIconBox} />
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
  // Recent session trajectory — diverging bars about a zero line.
  trajChart: { paddingTop: SPACING.xs },
  // Spans the full width rather than being stitched from per-column segments,
  // so it stays continuous through the gaps between bars.
  trajZeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: TRAJ_HALF + moderateScale(4),
    height: 1,
    backgroundColor: COLORS.cardBorder,
  },
  trajRow: { flexDirection: 'row', alignItems: 'flex-end' },
  trajCol: { flex: 1, alignItems: 'center' },
  // Wins fill downward toward the zero line; losses fill down away from it.
  trajHalfTop: {
    height: TRAJ_HALF,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  trajHalfBottom: {
    height: TRAJ_HALF,
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'hidden',
  },
  trajBar: { width: moderateScale(13) },
  // Rounded only at the outer end, so the bar reads as growing out of the axis.
  trajBarUp: {
    borderTopLeftRadius: moderateScale(3),
    borderTopRightRadius: moderateScale(3),
  },
  trajBarDown: {
    borderBottomLeftRadius: moderateScale(3),
    borderBottomRightRadius: moderateScale(3),
  },
  trajValue: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    marginVertical: 3,
  },
  trajLabel: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    marginTop: moderateScale(6),
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
  gridSub: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // This-month-vs-last comparison
  monthCard: { padding: SPACING.cardPadding },
  monthRow: { flexDirection: 'row', alignItems: 'flex-start' },
  monthCol: { flex: 1 },
  monthDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: SPACING.sm,
  },
  monthLabel: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  monthNet: {
    fontSize: fluidFont(22),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // Last month is context, not the headline — it stays muted so the eye
  // lands on the current month first.
  monthNetPast: { color: COLORS.textSecondary },
  monthMeta: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 4,
  },
  monthDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  monthDeltaText: {
    fontSize: fluidFont(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
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
  // Surface and size come from GameIconTile — this only positions it.
  portfolioIconBox: {
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
