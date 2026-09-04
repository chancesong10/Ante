import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { usePurchases } from '../context/PurchasesContext';
import { computeSportsInsights } from '../utils/sportsStatsEngine';
import { SkeletonBar, LockedLeakTeaser, InsightsUnlockCta } from '../components/InsightsPaywall';
import AuthGateScreen from '../components/AuthGateScreen';
import StatLine from '../components/InsightStatLine';
import CompareStat from '../components/InsightCompareStat';
import { NavBar } from '../components/ui';

// Turns a scored leak object from buildLeakReport into copy. Kept in the
// screen (not the engine) so the engine stays pure numbers — same split
// used for blackjack and poker. Only ever called when unlocked — locked
// users see LockedLeakTeaser instead, which never touches real leak data
// (e.g. worst_bet_type's title names the actual bet type).
function getLeakCopy(leak, { fmtMoney, fmtPct }) {
  switch (leak.id) {
    case 'negative_edge':
      return {
        title: "You're Underperforming Your Own Odds",
        detail: `Across ${leak.sample} decided bets, your own odds implied a ${fmtPct(leak.avgImpliedProbability)} win rate — but you've actually won ${fmtPct(leak.actualWinRate)} of them. That's a real gap between the price you bought and the result you got.`,
      };
    case 'favorite_longshot_bias':
      return {
        title: 'Underdog Bets Are Dragging You Down',
        detail: `Your underdog bets return ${fmtPct(leak.underdogRoi)} ROI${leak.favoriteRoi !== null ? ` vs. ${fmtPct(leak.favoriteRoi)} on favorites` : ''} (n=${leak.sample}). This is the classic "favorite-longshot bias" — longshots feel like good value but usually pay worse than their true odds.`,
      };
    case 'parlay_leak':
      return {
        title: 'Parlays Are Costing You',
        detail: `Your parlays return ${fmtPct(leak.parlayRoi)} ROI (n=${leak.sample}), well behind your ${fmtPct(leak.overallRoi)} overall. Parlays multiply the vig on every leg — the entertainment is real, but so is the cost.`,
      };
    case 'worst_bet_type':
      return {
        title: `Your ${leak.betType} Bets Are The Leak`,
        detail: `${leak.betType} bets return ${fmtPct(leak.roi)} ROI (n=${leak.sample}), well behind your ${fmtPct(leak.overallRoi)} overall across every other type.`,
      };
    case 'live_betting_leak':
      return {
        title: 'Live Betting Is Underperforming Pregame',
        detail: `Live/in-play bets return ${fmtPct(leak.liveRoi)} ROI vs. ${fmtPct(leak.pregameRoi)} pregame (n=${leak.sample}). Live lines carry more vig and less time to think — a common leak spot.`,
      };
    case 'loss_chasing':
      return {
        title: 'You Bet Bigger After Losing',
        detail: `You stake ${fmtMoney(leak.avgBetAfterLoss)} on average right after a losing bet, vs. ${fmtMoney(leak.avgBetAfterWin)} after a winning one — ${leak.pctIncrease.toFixed(0)}% more. That's a classic loss-chasing pattern.`,
      };
    case 'volatility':
      return {
        title: 'Your Results Are Highly Volatile',
        detail: `Your net result per bet swings about ${leak.volatilityRatio.toFixed(1)}x your average stake. Big swings add variance risk on top of whatever edge you have.`,
      };
    default:
      return { title: 'Leak Detected', detail: '' };
  }
}

export default function SportsBettingInsightsScreen({ navigation }) {
  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$' } = usePreferences();
  const { user } = useAuth();
  const { isPro } = usePurchases();
  const isLocked = !isPro;
  const insets = useSafeAreaInsets();

  // Without this, Android hardware back on this screen falls through to
  // whatever BackHandler listener is still registered on a screen mounted
  // underneath it in the stack (e.g. an in-progress game session) — see the
  // same fix on AuthScreen.js.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const stats = useMemo(() => computeSportsInsights(sessionHistory), [sessionHistory]);
  const hasEnoughData = stats.totalHands >= 5;

  const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
  const fmtMoney = (v) => `${v >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(v).toFixed(2)}`;

  const outcomes = stats.outcomeBreakdown;
  const returns = stats.returnStats;
  const oddsEdge = stats.oddsEdge;
  const favDog = stats.favoriteUnderdog;
  const betTypes = stats.betTypeStats;
  const sportStats = stats.sportStats;
  const liveVsPregame = stats.liveVsPregame;
  const betSizeAfterOutcome = stats.betSizeAfterOutcome;
  const streaks = stats.streaks;
  const cwr = stats.conditionalWinRates;
  const vol = stats.volatility;
  const tiers = stats.betTierWinRates;
  const dow = stats.dayOfWeekPerformance;
  const lenPerf = stats.sessionLengthPerformance;
  const topLeak = stats.topLeak;

  const betSizeDelta = betSizeAfterOutcome.avgBetAfterLoss - betSizeAfterOutcome.avgBetAfterWin;
  const chasesLosses = betSizeDelta > 0 && betSizeAfterOutcome.sampleAfterLoss >= 3;
  const disciplinedSizing = betSizeDelta <= 0 && betSizeAfterOutcome.sampleAfterLoss >= 3;

  const streakColor =
    streaks.currentStreakType === 'win' ? COLORS.success : streaks.currentStreakType === 'loss' ? COLORS.danger : COLORS.textPrimary;

  const riskLabelColor =
    vol.riskLabel === 'Low' ? COLORS.success : vol.riskLabel === 'High' ? COLORS.danger : COLORS.warning;

  const edgeColor = oddsEdge && oddsEdge.edge > 0 ? COLORS.success : oddsEdge && oddsEdge.edge < 0 ? COLORS.danger : COLORS.textPrimary;

  const [copied, setCopied] = useState(false);

  const buildReportText = () => {
    const lines = [];
    lines.push('ANTE — SPORTS BETTING INSIGHTS REPORT');
    lines.push(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push('');

    if (topLeak) {
      const copy = getLeakCopy(topLeak, { fmtMoney, fmtPct });
      lines.push('BIGGEST LEAK DETECTED');
      lines.push(copy.title);
      lines.push(copy.detail);
      lines.push('');
    }

    lines.push('PERFORMANCE OVERVIEW');
    lines.push(`Bets logged: ${outcomes.sample}`);
    lines.push(`Win / Push / Loss: ${fmtPct(outcomes.winRate)} / ${fmtPct(outcomes.pushRate)} / ${fmtPct(outcomes.lossRate)}`);
    lines.push(`Net Result: ${fmtMoney(returns.netProfit)}`);
    lines.push(`Return on Staked: ${returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'}`);
    lines.push('');

    if (oddsEdge) {
      lines.push('ODDS EDGE — ARE YOU BEATING YOUR OWN PRICE?');
      lines.push(`Actual win rate (n=${oddsEdge.sample}): ${fmtPct(oddsEdge.actualWinRate)}`);
      lines.push(`Average implied probability from your own odds: ${fmtPct(oddsEdge.avgImpliedProbability)}`);
      lines.push(`Edge: ${oddsEdge.edge >= 0 ? '+' : ''}${oddsEdge.edge.toFixed(1)} points`);
      lines.push('');
    }

    lines.push('FAVORITE VS. UNDERDOG');
    lines.push(`Favorites (n=${favDog.favorites.sample}): ${fmtPct(favDog.favorites.winRate)} win rate, ROI ${favDog.favorites.roi !== null ? `${favDog.favorites.roi.toFixed(1)}%` : '—'}`);
    lines.push(`Underdogs (n=${favDog.underdogs.sample}): ${fmtPct(favDog.underdogs.winRate)} win rate, ROI ${favDog.underdogs.roi !== null ? `${favDog.underdogs.roi.toFixed(1)}%` : '—'}`);
    lines.push('');

    if (betTypes.length > 0) {
      lines.push('PERFORMANCE BY BET TYPE');
      betTypes.forEach((t) => {
        lines.push(`${t.type} (n=${t.sample}): ${fmtPct(t.winRate)} win rate, ROI ${t.roi !== null ? `${t.roi.toFixed(1)}%` : '—'}`);
      });
      lines.push('');
    }

    if (sportStats) {
      lines.push('BEST & WORST SPORT (by ROI)');
      if (sportStats.best) lines.push(`Best: ${sportStats.best.sport}, ${sportStats.best.roi.toFixed(1)}% ROI (n=${sportStats.best.sample})`);
      if (sportStats.worst) lines.push(`Worst: ${sportStats.worst.sport}, ${sportStats.worst.roi.toFixed(1)}% ROI (n=${sportStats.worst.sample})`);
      lines.push('');
    }

    if (liveVsPregame) {
      lines.push('LIVE VS. PREGAME');
      lines.push(`Live (n=${liveVsPregame.live.sample}): ROI ${liveVsPregame.live.roi !== null ? `${liveVsPregame.live.roi.toFixed(1)}%` : '—'}`);
      lines.push(`Pregame (n=${liveVsPregame.pregame.sample}): ROI ${liveVsPregame.pregame.roi !== null ? `${liveVsPregame.pregame.roi.toFixed(1)}%` : '—'}`);
      lines.push('');
    }

    lines.push('STREAKS');
    lines.push(`Current streak: ${streaks.currentStreakType ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'win' ? 'Win' : 'Loss'}` : 'None'}`);
    lines.push(`Longest win streak: ${streaks.longestWinStreak}`);
    lines.push(`Longest loss streak: ${streaks.longestLossStreak}`);
    lines.push('');

    lines.push('STAKE SIZE AFTER OUTCOME');
    lines.push(`After a win: ${currencySymbol}${betSizeAfterOutcome.avgBetAfterWin.toFixed(2)}`);
    lines.push(`After a loss: ${currencySymbol}${betSizeAfterOutcome.avgBetAfterLoss.toFixed(2)}`);
    lines.push('');

    if (tiers) {
      lines.push('WIN RATE BY STAKE SIZE');
      lines.push(`Small (avg ${currencySymbol}${tiers.small.avgBet.toFixed(0)}, n=${tiers.small.sample}): ${fmtPct(tiers.small.winRate)}`);
      lines.push(`Medium (avg ${currencySymbol}${tiers.medium.avgBet.toFixed(0)}, n=${tiers.medium.sample}): ${fmtPct(tiers.medium.winRate)}`);
      lines.push(`Large (avg ${currencySymbol}${tiers.large.avgBet.toFixed(0)}, n=${tiers.large.sample}): ${fmtPct(tiers.large.winRate)}`);
      lines.push('');
    }

    lines.push('RISK & VOLATILITY');
    lines.push(`Risk level: ${vol.riskLabel || 'Not enough data'}`);
    lines.push('');

    if (dow) {
      lines.push('BEST & WORST DAYS (avg net profit per session)');
      lines.push(`Best: ${dow.best.day}, ${fmtMoney(dow.best.avgNet)}`);
      lines.push(`Worst: ${dow.worst.day}, ${fmtMoney(dow.worst.avgNet)}`);
      lines.push('');
    }

    if (lenPerf) {
      lines.push('PERFORMANCE BY SESSION LENGTH');
      lines.push(`Short, ≤10 bets (n=${lenPerf.short.sample}): ${lenPerf.short.avgNetPerHand !== null ? `${fmtMoney(lenPerf.short.avgNetPerHand)}/bet` : '—'}`);
      lines.push(`Medium, 11–25 bets (n=${lenPerf.medium.sample}): ${lenPerf.medium.avgNetPerHand !== null ? `${fmtMoney(lenPerf.medium.avgNetPerHand)}/bet` : '—'}`);
      lines.push(`Large, 25+ bets (n=${lenPerf.long.sample}): ${lenPerf.long.avgNetPerHand !== null ? `${fmtMoney(lenPerf.long.avgNetPerHand)}/bet` : '—'}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('This report was generated from data logged in Ante. It is informational only, not gambling or financial advice.');

    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    if (isLocked) {
      navigation.navigate('MainTabs', { screen: 'Profile' });
      return;
    }
    await Clipboard.setStringAsync(buildReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!user) {
    return <AuthGateScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <NavBar title="Sports betting insights" onBack={() => navigation.goBack()} />

      <View style={styles.contentArea}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + moderateScale(60) }]}
        showsVerticalScrollIndicator={false}
      >
        {!hasEnoughData && !isLocked ? (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Not Enough Data Yet</Text>
            <Text style={styles.emptyText}>
              Log at least 5 bets to unlock odds-edge, favorite/underdog, and leak analytics. Right now you have {stats.totalHands}.
            </Text>
          </View>
        ) : (
          <>
            {/* Leak Spotlight */}
            {isLocked ? (
              <LockedLeakTeaser />
            ) : topLeak ? (
              <View style={[styles.leakCard, SHADOWS.card]}>
                <View style={styles.leakEyebrowRow}>
                  <Ionicons name="warning" size={14} color={COLORS.warning} />
                  <Text style={styles.leakEyebrow}>Biggest leak detected</Text>
                </View>
                <Text style={styles.leakTitle}>{getLeakCopy(topLeak, { fmtMoney, fmtPct }).title}</Text>
                <Text style={styles.leakDetail}>{getLeakCopy(topLeak, { fmtMoney, fmtPct }).detail}</Text>
                {stats.leaks.length > 1 && (
                  <Text style={styles.leakMoreText}>+{stats.leaks.length - 1} more pattern{stats.leaks.length - 1 !== 1 ? 's' : ''} flagged below</Text>
                )}
              </View>
            ) : (
              <View style={[styles.card, SHADOWS.card, styles.noLeakCard]}>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
                <Text style={styles.noLeakTitle}>No Major Leaks Detected</Text>
                <Text style={styles.noLeakText}>
                  Your pricing, bet-type mix, and staking all look within a healthy range across {outcomes.sample} bets.
                </Text>
              </View>
            )}

            {/* Performance Overview */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>PERFORMANCE OVERVIEW</Text>
              <Text style={styles.cardHint}>Your actual results across {outcomes.sample} bets</Text>

              {isLocked ? (
                <>
                  <View style={styles.outcomeBarRow}>
                    <View style={[styles.outcomeBarSeg, { flex: 1, backgroundColor: COLORS.backgroundSecondary }]} />
                  </View>
                  <View style={styles.outcomeLegendRow}>
                    <SkeletonBar width={70} height={12} />
                    <SkeletonBar width={70} height={12} />
                    <SkeletonBar width={70} height={12} />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.outcomeBarRow}>
                    {outcomes.winRate > 0 && <View style={[styles.outcomeBarSeg, { flex: outcomes.winRate, backgroundColor: COLORS.success }]} />}
                    {outcomes.pushRate > 0 && <View style={[styles.outcomeBarSeg, { flex: outcomes.pushRate, backgroundColor: COLORS.textMuted }]} />}
                    {outcomes.lossRate > 0 && <View style={[styles.outcomeBarSeg, { flex: outcomes.lossRate, backgroundColor: COLORS.danger }]} />}
                  </View>
                  <View style={styles.outcomeLegendRow}>
                    <View style={styles.outcomeLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                      <Text style={styles.outcomeLegendText}>Win {fmtPct(outcomes.winRate)}</Text>
                    </View>
                    <View style={styles.outcomeLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.textMuted }]} />
                      <Text style={styles.outcomeLegendText}>Push {fmtPct(outcomes.pushRate)}</Text>
                    </View>
                    <View style={styles.outcomeLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                      <Text style={styles.outcomeLegendText}>Loss {fmtPct(outcomes.lossRate)}</Text>
                    </View>
                  </View>
                </>
              )}

              <View style={styles.overviewDivider} />

              <View style={styles.compareRow}>
                <CompareStat
                  label="Net Result"
                  value={fmtMoney(returns.netProfit)}
                  valueColor={returns.netProfit > 0 ? COLORS.success : returns.netProfit < 0 ? COLORS.danger : COLORS.textPrimary}
                  locked={isLocked}
                />
                <CompareStat
                  label="Return on Staked"
                  value={returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'}
                  valueColor={(returns.roi || 0) > 0 ? COLORS.success : (returns.roi || 0) < 0 ? COLORS.danger : COLORS.textPrimary}
                  locked={isLocked}
                />
                <CompareStat label="Avg / Bet" value={returns.avgResultPerHand !== null ? fmtMoney(returns.avgResultPerHand) : '—'} locked={isLocked} />
              </View>
            </View>

            {/* Odds Edge — the headline "pro metric" */}
            {oddsEdge && (
              <View style={[styles.card, SHADOWS.card]}>
                <View style={styles.proRow}>
                  <Ionicons name="ribbon-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.proRowLabel}>PRO METRIC — ARE YOU BEATING YOUR OWN PRICE?</Text>
                </View>
                <Text style={styles.cardHint}>Your win rate vs. the win probability your own odds implied</Text>
                <View style={styles.compareRow}>
                  <CompareStat label={`Actual Win Rate (n=${oddsEdge.sample})`} value={fmtPct(oddsEdge.actualWinRate)} locked={isLocked} />
                  <CompareStat label="Avg Implied Probability" value={fmtPct(oddsEdge.avgImpliedProbability)} locked={isLocked} />
                  <CompareStat
                    label="Edge"
                    value={`${oddsEdge.edge >= 0 ? '+' : ''}${oddsEdge.edge.toFixed(1)} pts`}
                    valueColor={edgeColor}
                    locked={isLocked}
                  />
                </View>
                <Text style={styles.cardFootnote}>
                  A positive edge means you're winning more often than the price you bought implied — a real signal, not just variance. A negative edge means you're losing even relative to your own odds.
                </Text>
              </View>
            )}

            {/* Favorite vs Underdog */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>FAVORITE VS. UNDERDOG</Text>
              <Text style={styles.cardHint}>Negative-odds favorites vs. positive-odds underdogs</Text>
              <View style={styles.compareRow}>
                <CompareStat
                  label={`Favorites (n=${favDog.favorites.sample})`}
                  value={fmtPct(favDog.favorites.winRate)}
                  sub={`ROI: ${favDog.favorites.roi !== null ? `${favDog.favorites.roi.toFixed(1)}%` : '—'}`}
                  locked={isLocked}
                />
                <CompareStat
                  label={`Underdogs (n=${favDog.underdogs.sample})`}
                  value={fmtPct(favDog.underdogs.winRate)}
                  sub={`ROI: ${favDog.underdogs.roi !== null ? `${favDog.underdogs.roi.toFixed(1)}%` : '—'}`}
                  locked={isLocked}
                />
              </View>
            </View>

            {/* Bet Type Breakdown */}
            {betTypes.length > 0 && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>PERFORMANCE BY BET TYPE</Text>
                {betTypes.map((t) => (
                  <StatLine
                    key={t.type}
                    label={`${t.type} (n=${t.sample})`}
                    value={t.roi !== null ? `${t.roi >= 0 ? '+' : ''}${t.roi.toFixed(1)}% ROI` : '—'}
                    valueColor={t.roi !== null ? (t.roi > 0 ? COLORS.success : t.roi < 0 ? COLORS.danger : undefined) : undefined}
                    locked={isLocked}
                  />
                ))}
              </View>
            )}

            {/* Sport Breakdown */}
            {sportStats && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>BEST & WORST SPORT</Text>
                <Text style={styles.cardHint}>By return on staked, minimum 3 bets per sport</Text>
                {sportStats.best && (
                  <StatLine
                    label={`Best: ${sportStats.best.sport} (n=${sportStats.best.sample})`}
                    value={`${sportStats.best.roi >= 0 ? '+' : ''}${sportStats.best.roi.toFixed(1)}%`}
                    valueColor={COLORS.success}
                    locked={isLocked}
                  />
                )}
                {sportStats.worst && (
                  <StatLine
                    label={`Worst: ${sportStats.worst.sport} (n=${sportStats.worst.sample})`}
                    value={`${sportStats.worst.roi >= 0 ? '+' : ''}${sportStats.worst.roi.toFixed(1)}%`}
                    valueColor={COLORS.danger}
                    locked={isLocked}
                  />
                )}
              </View>
            )}

            {/* Live vs Pregame */}
            {liveVsPregame && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LIVE VS. PREGAME</Text>
                <View style={styles.compareRow}>
                  <CompareStat
                    label={`Live (n=${liveVsPregame.live.sample})`}
                    value={liveVsPregame.live.roi !== null ? `${liveVsPregame.live.roi >= 0 ? '+' : ''}${liveVsPregame.live.roi.toFixed(1)}%` : '—'}
                    locked={isLocked}
                  />
                  <CompareStat
                    label={`Pregame (n=${liveVsPregame.pregame.sample})`}
                    value={liveVsPregame.pregame.roi !== null ? `${liveVsPregame.pregame.roi >= 0 ? '+' : ''}${liveVsPregame.pregame.roi.toFixed(1)}%` : '—'}
                    locked={isLocked}
                  />
                </View>
              </View>
            )}

            {/* Conditional Win Rate */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>CONDITIONAL WIN RATE</Text>
              <Text style={styles.cardHint}>Your win rate depending on what just happened</Text>
              <StatLine label={`After a Win (n=${cwr.afterWin.sample})`} value={fmtPct(cwr.afterWin.rate)} locked={isLocked} />
              <StatLine label={`After a Loss (n=${cwr.afterLoss.sample})`} value={fmtPct(cwr.afterLoss.rate)} locked={isLocked} />
            </View>

            {/* Stake Size After Outcome */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>STAKE SIZE AFTER OUTCOME</Text>
              <StatLine label="After a Win" value={`${currencySymbol}${betSizeAfterOutcome.avgBetAfterWin.toFixed(2)}`} locked={isLocked} />
              <StatLine label="After a Loss" value={`${currencySymbol}${betSizeAfterOutcome.avgBetAfterLoss.toFixed(2)}`} locked={isLocked} />
              {!isLocked && chasesLosses && (
                <View style={styles.insightNote}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.insightNoteText}>
                    You stake {((betSizeDelta / (betSizeAfterOutcome.avgBetAfterWin || 1)) * 100).toFixed(0)}% more right after losing a bet than after winning one — a loss-chasing pattern worth watching.
                  </Text>
                </View>
              )}
              {!isLocked && disciplinedSizing && (
                <View style={styles.insightNote}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.success} />
                  <Text style={styles.insightNoteText}>You don't bet bigger after a loss to try to win it back — that's disciplined staking.</Text>
                </View>
              )}
            </View>

            {/* Streaks */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>CURRENT STREAK</Text>
              {isLocked ? (
                <SkeletonBar width={100} height={26} style={{ marginTop: 4 }} />
              ) : (
                <Text style={[styles.streakValue, { color: streakColor }]}>
                  {streaks.currentStreakType
                    ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'win' ? 'Win' : 'Loss'}${streaks.currentStreakLength !== 1 ? 's' : ''}`
                    : 'None'}
                </Text>
              )}
            </View>

            <View style={styles.rowCards}>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LONGEST WIN STREAK</Text>
                {isLocked ? <SkeletonBar width={36} height={20} /> : <Text style={[styles.halfValue, { color: COLORS.success }]}>{streaks.longestWinStreak}</Text>}
              </View>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LONGEST LOSS STREAK</Text>
                {isLocked ? <SkeletonBar width={36} height={20} /> : <Text style={[styles.halfValue, { color: COLORS.danger }]}>{streaks.longestLossStreak}</Text>}
              </View>
            </View>

            {/* Win Rate by Stake Tier */}
            {tiers && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>WIN RATE BY STAKE SIZE</Text>
                <Text style={styles.cardHint}>Based on your own small / medium / large stake ranges</Text>
                <StatLine label={`Small (avg ${currencySymbol}${tiers.small.avgBet.toFixed(0)}, n=${tiers.small.sample})`} value={fmtPct(tiers.small.winRate)} locked={isLocked} />
                <StatLine label={`Medium (avg ${currencySymbol}${tiers.medium.avgBet.toFixed(0)}, n=${tiers.medium.sample})`} value={fmtPct(tiers.medium.winRate)} locked={isLocked} />
                <StatLine label={`Large (avg ${currencySymbol}${tiers.large.avgBet.toFixed(0)}, n=${tiers.large.sample})`} value={fmtPct(tiers.large.winRate)} locked={isLocked} />
              </View>
            )}

            {/* Risk & Volatility */}
            <View style={[styles.card, SHADOWS.card]}>
              <View style={styles.riskHeaderRow}>
                <Text style={styles.cardLabel}>RISK & VOLATILITY</Text>
                {isLocked ? (
                  <SkeletonBar width={56} height={18} />
                ) : (
                  vol.riskLabel && (
                    <View style={[styles.riskBadge, { backgroundColor: `${riskLabelColor}22`, borderColor: riskLabelColor }]}>
                      <Text style={[styles.riskBadgeText, { color: riskLabelColor }]}>{vol.riskLabel}</Text>
                    </View>
                  )
                )}
              </View>
              <Text style={styles.cardHint}>
                {isLocked
                  ? 'See how consistent your staking and results really are.'
                  : vol.riskLabel
                  ? `Your results typically swing about ${vol.volatilityRatio.toFixed(1)}x your average stake, bet to bet.`
                  : 'Not enough stake variation yet to score this.'}
              </Text>
            </View>

            {/* Day of Week */}
            {dow && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>BEST & WORST DAYS</Text>
                <StatLine
                  label={`Best: ${dow.best.day} (${dow.best.sessions} session${dow.best.sessions !== 1 ? 's' : ''})`}
                  value={fmtMoney(dow.best.avgNet)}
                  valueColor={COLORS.success}
                  locked={isLocked}
                />
                <StatLine
                  label={`Worst: ${dow.worst.day} (${dow.worst.sessions} session${dow.worst.sessions !== 1 ? 's' : ''})`}
                  value={fmtMoney(dow.worst.avgNet)}
                  valueColor={COLORS.danger}
                  locked={isLocked}
                />
              </View>
            )}

            {/* Session Length Performance */}
            {lenPerf && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>PERFORMANCE BY SESSION LENGTH</Text>
                <StatLine
                  label={`Short: ≤10 bets (n=${lenPerf.short.sample})`}
                  value={lenPerf.short.avgNetPerHand !== null ? `${fmtMoney(lenPerf.short.avgNetPerHand)}/bet` : '—'}
                  locked={isLocked}
                />
                <StatLine
                  label={`Medium: 11–25 bets (n=${lenPerf.medium.sample})`}
                  value={lenPerf.medium.avgNetPerHand !== null ? `${fmtMoney(lenPerf.medium.avgNetPerHand)}/bet` : '—'}
                  locked={isLocked}
                />
                <StatLine
                  label={`Large: 25+ bets (n=${lenPerf.long.sample})`}
                  value={lenPerf.long.avgNetPerHand !== null ? `${fmtMoney(lenPerf.long.avgNetPerHand)}/bet` : '—'}
                  locked={isLocked}
                />
              </View>
            )}

            {/* Copy Report */}
            <TouchableOpacity style={[styles.copyReportBtn, SHADOWS.card, isLocked && styles.copyReportBtnLocked]} activeOpacity={0.85} onPress={handleCopyReport}>
              <Ionicons name={isLocked ? 'lock-closed' : copied ? 'checkmark-circle' : 'clipboard-outline'} size={18} color={COLORS.textDark} style={{ marginRight: 8 }} />
              <Text style={styles.copyReportBtnText}>{isLocked ? 'Unlock Ante+ to Copy Report' : copied ? 'Copied to Clipboard' : 'Copy Full Report'}</Text>
            </TouchableOpacity>
            <Text style={styles.copyReportHint}>
              Paste this into a doc or an AI chat to dig into your numbers further. It's a plain-text summary of everything on this page — not gambling advice.
            </Text>
          </>
        )}
      </ScrollView>
      {isLocked && (
        <InsightsUnlockCta
          subtitle="Your odds edge, favorite vs. underdog splits, and leak detection — unlocked with Ante+."
          onPress={() => navigation.navigate('AntePlus')}
        />
      )}
      </View>
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
  contentArea: { flex: 1 },
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
  leakCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.warningBorder,
    marginBottom: 14,
  },
  leakEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  leakEyebrow: { fontSize: 12, fontWeight: '700', color: COLORS.warning },
  leakTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  leakDetail: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  leakMoreText: { fontSize: 11, color: COLORS.textMuted, marginTop: 10, fontWeight: '600' },
  noLeakCard: { alignItems: 'center', paddingVertical: 22 },
  noLeakTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
  noLeakText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  cardLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  cardHint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 10 },
  cardFootnote: { fontSize: 11, color: COLORS.textMuted, marginTop: 8, lineHeight: 15 },
  streakValue: { fontSize: 28, fontWeight: '700' },
  rowCards: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  halfCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'space-between',
    minHeight: 90,
  },
  halfValue: { fontSize: 24, fontWeight: '700', marginTop: 8 },
  compareRow: { flexDirection: 'row', gap: 10 },
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
  outcomeBarRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: COLORS.backgroundSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  outcomeBarSeg: { height: '100%' },
  outcomeLegendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 },
  outcomeLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  outcomeLegendText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  overviewDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 12 },
  proRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  proRowLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.8 },
  riskHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  riskBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  copyReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  copyReportBtnLocked: { backgroundColor: COLORS.textMuted },
  copyReportBtnText: { color: COLORS.textDark, fontWeight: '700', fontSize: 15 },
  copyReportHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 8,
    paddingHorizontal: 8,
  },
});
