import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, LAYOUT } from '../constants/layout';
import { netTone } from '../utils/format';
import { NavBar, Tappable } from '../components/ui';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { usePurchases } from '../context/PurchasesContext';
import { computeInsights } from '../utils/statsEngine';
import { SkeletonBar, LockedLeakTeaser, InsightsUnlockCta } from '../components/InsightsPaywall';
import AuthGateScreen from '../components/AuthGateScreen';
import StatLine from '../components/InsightStatLine';
import CompareStat from '../components/InsightCompareStat';

// Turns a scored leak object from buildLeakReport into copy. Kept in the
// screen (not the engine) so the engine stays pure numbers — same split
// used for the poker and sports-betting insights screens. Only ever
// called when unlocked — locked users see LockedLeakTeaser instead, which
// never touches real leak data (some leak titles interpolate real values,
// e.g. which day or bet type).
function getLeakCopy(leak, { fmtDollar, fmtPct }) {
  switch (leak.id) {
    case 'loss_chasing':
      return {
        title: 'You Bet Bigger After Losing',
        detail: `You bet ${fmtDollar(leak.avgBetAfterLoss)} on average right after a loss, vs. ${fmtDollar(leak.avgBetAfterWin)} after a win — ${leak.pctIncrease.toFixed(0)}% more. That's a classic loss-chasing pattern.`,
      };
    case 'double_down_underuse':
      return {
        title: "You're Leaving Profitable Doubles on the Table",
        detail: `You double down on ${fmtPct(leak.rate)} of hands (n=${leak.sample}), well under the ~${leak.benchmarkRate}% basic strategy suggests. Underdoubling gives up known long-run value on strong hands.`,
      };
    case 'double_down_overuse':
      return {
        title: "You're Doubling More Than Basic Strategy Suggests",
        detail: `You double down on ${fmtPct(leak.rate)} of hands (n=${leak.sample}), well above the ~${leak.benchmarkRate}% basic strategy suggests. Worth checking you're only doubling hard 9–11 and strong soft hands.`,
      };
    case 'doubling_underperformance':
      return {
        title: "Your Doubles Aren't Paying Off",
        detail: `Doubled hands are running at ${leak.doubledRoi.toFixed(1)}% ROI (n=${leak.sample})${leak.notDoubledRoi !== null ? `, well behind your ${leak.notDoubledRoi.toFixed(1)}% ROI on hands you didn't double` : ''}. Small samples of doubles swing hard, but this is worth tracking.`,
      };
    case 'bet_tier_dropoff':
      return {
        title: 'Your Win Rate Drops on Your Biggest Bets',
        detail: `Your win rate is ${fmtPct(leak.smallWinRate)} on your smallest bets (n=${leak.sampleSmall}) but only ${fmtPct(leak.largeWinRate)} on your largest (n=${leak.sampleLarge}). That can be variance, but it can also mean bigger bets are going in on worse decisions.`,
      };
    case 'volatility':
      return {
        title: 'Your Results Are Highly Volatile',
        detail: `Your net result per hand swings about ${leak.volatilityRatio.toFixed(1)}x your average bet, hand to hand. Big swings add variance risk on top of whatever edge basic strategy gives you.`,
      };
    default:
      return { title: 'Leak Detected', detail: '' };
  }
}

export default function InsightsScreen({ route, navigation }) {
  const { gameType } = route.params;
  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$' } = usePreferences();
  const { user } = useAuth();
  const { isPro, presentPaywallIfNeeded } = usePurchases();
  const insets = useSafeAreaInsets();
  const isLocked = !isPro;

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

  const stats = useMemo(() => computeInsights(sessionHistory, gameType), [sessionHistory, gameType]);
  const hasEnoughData = stats.totalHands >= 5;

  const streakColor =
    stats.currentStreakType === 'win'
      ? COLORS.success
      : stats.currentStreakType === 'loss'
      ? COLORS.danger
      : COLORS.textPrimary;

  const betSizeDelta = stats.avgBetAfterLoss - stats.avgBetAfterWin;
  const chasesLosses = betSizeDelta > 0 && stats.sampleAfterLoss >= 3;
  const disciplinedSizing = betSizeDelta <= 0 && stats.sampleAfterLoss >= 3;

  const isBlackjack = gameType === 'Blackjack';

  const outcomes = stats.outcomeBreakdown;
  const returns = stats.returnStats;
  const cwr = stats.conditionalWinRates;
  const dbl = stats.doublingStats;
  const ddr = stats.doubleDownRate;
  const bj = stats.blackjackFrequency;
  const tiers = stats.betTierWinRates;
  const vol = stats.volatility;
  const dow = stats.dayOfWeekPerformance;
  const lenPerf = stats.sessionLengthPerformance;

  const bjRateDelta = isBlackjack ? bj.actualRate - bj.expectedRate : 0;

  const riskLabelColor =
    vol.riskLabel === 'Low' ? COLORS.success : vol.riskLabel === 'High' ? COLORS.danger : COLORS.warning;

  const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
  const fmtMoney = (v) => `${v >= 0 ? '+' : '−'}${currencySymbol}${Math.abs(v).toFixed(2)}`;
  const fmtDollar = (v) => `${currencySymbol}${v.toFixed(2)}`;

  const topLeak = stats.topLeak;

  const [copied, setCopied] = useState(false);

  const buildReportText = () => {
    const lines = [];
    lines.push(`ANTE — ${gameType.toUpperCase()} INSIGHTS REPORT`);
    lines.push(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push('');

    if (topLeak) {
      const copy = getLeakCopy(topLeak, { fmtDollar, fmtPct });
      lines.push('BIGGEST LEAK DETECTED');
      lines.push(copy.title);
      lines.push(copy.detail);
      lines.push('');
    }

    lines.push('PERFORMANCE OVERVIEW');
    lines.push(`Hands logged: ${outcomes.sample}`);
    lines.push(
      `Win / Push / Loss: ${fmtPct(outcomes.winRate)} / ${fmtPct(outcomes.pushRate)} / ${fmtPct(outcomes.lossRate)} (${outcomes.wins}W / ${outcomes.pushes}P / ${outcomes.losses}L)`
    );
    lines.push(`Net Result: ${fmtMoney(returns.netProfit)}`);
    lines.push(`Return on Wagered: ${returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'}`);
    lines.push(`Avg Result / Hand: ${returns.avgResultPerHand !== null ? fmtMoney(returns.avgResultPerHand) : '—'}`);
    lines.push('');

    lines.push('STREAKS');
    lines.push(
      `Current streak: ${stats.currentStreakType ? `${stats.currentStreakLength} ${stats.currentStreakType === 'win' ? 'Win' : 'Loss'}${stats.currentStreakLength !== 1 ? 's' : ''}` : 'None'}`
    );
    lines.push(`Longest win streak: ${stats.longestWinStreak}`);
    lines.push(`Longest loss streak: ${stats.longestLossStreak}`);
    lines.push('');

    lines.push('CONDITIONAL WIN RATE (pushes excluded from rate)');
    lines.push(`After a Win (n=${cwr.afterWin.sample}): ${fmtPct(cwr.afterWin.rate)}`);
    lines.push(`After a Loss (n=${cwr.afterLoss.sample}): ${fmtPct(cwr.afterLoss.rate)}`);
    lines.push(`After 2 Wins (n=${cwr.afterTwoWins.sample}): ${fmtPct(cwr.afterTwoWins.rate)}`);
    lines.push(`After 2 Losses (n=${cwr.afterTwoLosses.sample}): ${fmtPct(cwr.afterTwoLosses.rate)}`);
    lines.push('');

    if (isBlackjack) {
      lines.push('DOUBLING PERFORMANCE');
      lines.push(
        `Doubled (n=${dbl.doubled.sample}): ${fmtPct(dbl.doubled.winRate)} win rate, ROI ${dbl.doubled.roi !== null ? `${dbl.doubled.roi.toFixed(1)}%` : '—'}`
      );
      lines.push(
        `Not doubled (n=${dbl.notDoubled.sample}): ${fmtPct(dbl.notDoubled.winRate)} win rate, ROI ${dbl.notDoubled.roi !== null ? `${dbl.notDoubled.roi.toFixed(1)}%` : '—'}`
      );
      if (ddr) {
        lines.push(`Double-down frequency: ${ddr.rate.toFixed(1)}% of hands (reference: ~${ddr.benchmarkRate}%)`);
      }
      lines.push(`Natural blackjack rate: ${bj.actualRate.toFixed(1)}% (${bj.count}/${bj.sample}) vs. expected ~${bj.expectedRate}%`);
      lines.push('');
    }

    if (tiers) {
      lines.push('WIN RATE BY BET SIZE (pushes excluded from rate)');
      lines.push(`Small (avg ${currencySymbol}${tiers.small.avgBet.toFixed(0)}, n=${tiers.small.sample}): ${fmtPct(tiers.small.winRate)}`);
      lines.push(`Medium (avg ${currencySymbol}${tiers.medium.avgBet.toFixed(0)}, n=${tiers.medium.sample}): ${fmtPct(tiers.medium.winRate)}`);
      lines.push(`Large (avg ${currencySymbol}${tiers.large.avgBet.toFixed(0)}, n=${tiers.large.sample}): ${fmtPct(tiers.large.winRate)}`);
      lines.push('');
    }

    lines.push('RISK & VOLATILITY');
    lines.push(`Risk level: ${vol.riskLabel || 'Not enough data'}`);
    lines.push(`Net result std. deviation: ${currencySymbol}${vol.netResultStdDev.toFixed(2)}`);
    lines.push(`Bet size std. deviation: ${currencySymbol}${vol.betSizeStdDev.toFixed(2)}`);
    lines.push(`Bet sizing consistency: ${vol.betSizeConsistency !== null ? `${vol.betSizeConsistency.toFixed(0)}/100` : '—'}`);
    lines.push('');

    lines.push('BET SIZE AFTER OUTCOME');
    lines.push(`After a win: ${currencySymbol}${stats.avgBetAfterWin.toFixed(2)}`);
    lines.push(`After a loss: ${currencySymbol}${stats.avgBetAfterLoss.toFixed(2)}`);
    lines.push('');

    if (dow) {
      lines.push('BEST & WORST DAYS (avg net profit per session)');
      lines.push(`Best: ${dow.best.day}, ${fmtMoney(dow.best.avgNet)} (${dow.best.sessions} session${dow.best.sessions !== 1 ? 's' : ''})`);
      lines.push(`Worst: ${dow.worst.day}, ${fmtMoney(dow.worst.avgNet)} (${dow.worst.sessions} session${dow.worst.sessions !== 1 ? 's' : ''})`);
      lines.push('');
    }

    if (lenPerf) {
      lines.push('PERFORMANCE BY SESSION LENGTH');
      lines.push(`Short, ≤10 hands (n=${lenPerf.short.sample}): ${lenPerf.short.avgNetPerHand !== null ? `${fmtMoney(lenPerf.short.avgNetPerHand)}/hand` : '—'}`);
      lines.push(`Medium, 11–25 hands (n=${lenPerf.medium.sample}): ${lenPerf.medium.avgNetPerHand !== null ? `${fmtMoney(lenPerf.medium.avgNetPerHand)}/hand` : '—'}`);
      lines.push(`Large, 25+ hands (n=${lenPerf.long.sample}): ${lenPerf.long.avgNetPerHand !== null ? `${fmtMoney(lenPerf.long.avgNetPerHand)}/hand` : '—'}`);
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
      <NavBar title={`${gameType} insights`} onBack={() => navigation.goBack()} />

      <View style={styles.contentArea}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + LAYOUT.scrollTail },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {!hasEnoughData && !isLocked ? (
            <View style={styles.emptyCard}>
              <Ionicons name="analytics-outline" size={moderateScale(28)} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Not enough data yet</Text>
              <Text style={styles.emptyText}>
                Log at least 5 {gameType} hands to unlock behavioral insights. Right now you have {stats.totalHands}.
              </Text>
            </View>
          ) : (
            <>
              {/* Leak spotlight */}
              {isLocked ? (
                <LockedLeakTeaser />
              ) : topLeak ? (
                <View style={styles.leakCard}>
                  <View style={styles.leakEyebrowRow}>
                    <Ionicons name="warning" size={moderateScale(14)} color={COLORS.warning} />
                    <Text style={styles.leakEyebrow}>Biggest leak detected</Text>
                  </View>
                  <Text style={styles.leakTitle}>{getLeakCopy(topLeak, { fmtDollar, fmtPct }).title}</Text>
                  <Text style={styles.leakDetail}>{getLeakCopy(topLeak, { fmtDollar, fmtPct }).detail}</Text>
                  {stats.leaks.length > 1 && (
                    <Text style={styles.leakMoreText}>
                      +{stats.leaks.length - 1} more pattern{stats.leaks.length - 1 !== 1 ? 's' : ''} flagged below
                    </Text>
                  )}
                </View>
              ) : (
                <View style={[styles.card, styles.noLeakCard]}>
                  <Ionicons name="shield-checkmark" size={moderateScale(20)} color={COLORS.success} />
                  <Text style={styles.noLeakTitle}>No major leaks detected</Text>
                  <Text style={styles.noLeakText}>
                    Your bet sizing, doubling decisions, and volatility all look within a healthy range across{' '}
                    {outcomes.sample} hands.
                  </Text>
                </View>
              )}

              {/* Performance overview — the baseline everything below is relative to */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Performance overview</Text>
                <Text style={styles.cardHint}>Your actual results across {outcomes.sample} hands</Text>

                {isLocked ? (
                  <>
                    <View style={styles.outcomeBarRow}>
                      <View style={[styles.outcomeBarSeg, { flex: 1, backgroundColor: COLORS.background }]} />
                    </View>
                    <View style={styles.outcomeLegendRow}>
                      <SkeletonBar width={80} height={12} />
                      <SkeletonBar width={80} height={12} />
                      <SkeletonBar width={80} height={12} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.outcomeBarRow}>
                      {outcomes.winRate > 0 && (
                        <View style={[styles.outcomeBarSeg, { flex: outcomes.winRate, backgroundColor: COLORS.success }]} />
                      )}
                      {outcomes.pushRate > 0 && (
                        <View style={[styles.outcomeBarSeg, { flex: outcomes.pushRate, backgroundColor: COLORS.textMuted }]} />
                      )}
                      {outcomes.lossRate > 0 && (
                        <View style={[styles.outcomeBarSeg, { flex: outcomes.lossRate, backgroundColor: COLORS.danger }]} />
                      )}
                    </View>

                    <View style={styles.outcomeLegendRow}>
                      <View style={styles.outcomeLegendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                        <Text style={styles.outcomeLegendText}>Win {fmtPct(outcomes.winRate)} ({outcomes.wins})</Text>
                      </View>
                      <View style={styles.outcomeLegendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.textMuted }]} />
                        <Text style={styles.outcomeLegendText}>Push {fmtPct(outcomes.pushRate)} ({outcomes.pushes})</Text>
                      </View>
                      <View style={styles.outcomeLegendItem}>
                        <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                        <Text style={styles.outcomeLegendText}>Loss {fmtPct(outcomes.lossRate)} ({outcomes.losses})</Text>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.overviewDivider} />

                <View style={styles.compareRow}>
                  <CompareStat
                    label="Net result"
                    value={fmtMoney(returns.netProfit)}
                    valueColor={netTone(returns.netProfit)}
                    locked={isLocked}
                  />
                  <CompareStat
                    label="Return on wagered"
                    value={returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'}
                    valueColor={netTone(returns.roi || 0)}
                    locked={isLocked}
                  />
                  <CompareStat
                    label="Avg / hand"
                    value={returns.avgResultPerHand !== null ? fmtMoney(returns.avgResultPerHand) : '—'}
                    locked={isLocked}
                  />
                </View>
                <Text style={styles.cardFootnote}>
                  {isBlackjack
                    ? "Return on wagered accounts for bet size, doubles, and blackjack's 3:2 payout — a more honest read on how you're actually doing than win rate alone."
                    : "Return on wagered accounts for bet size — a more honest read on how you're actually doing than win rate alone."}
                </Text>
              </View>

              {/* Current streak */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Current streak</Text>
                {isLocked ? (
                  <SkeletonBar width={110} height={26} style={{ marginTop: 4 }} />
                ) : (
                  <Text style={[styles.streakValue, { color: streakColor }]}>
                    {stats.currentStreakType
                      ? `${stats.currentStreakLength} ${stats.currentStreakType === 'win' ? 'Win' : 'Loss'}${stats.currentStreakLength !== 1 ? 's' : ''}`
                      : 'None'}
                  </Text>
                )}
              </View>

              <View style={styles.rowCards}>
                <View style={styles.halfCard}>
                  <View style={styles.halfCardHeader}>
                    <Text style={styles.cardLabel}>Longest win streak</Text>
                  </View>
                  {isLocked ? (
                    <SkeletonBar width={40} height={22} />
                  ) : (
                    <Text style={[styles.halfValue, { color: COLORS.success }]}>{stats.longestWinStreak}</Text>
                  )}
                </View>
                <View style={styles.halfCard}>
                  <View style={styles.halfCardHeader}>
                    <Text style={styles.cardLabel}>Longest loss streak</Text>
                  </View>
                  {isLocked ? (
                    <SkeletonBar width={40} height={22} />
                  ) : (
                    <Text style={[styles.halfValue, { color: COLORS.danger }]}>{stats.longestLossStreak}</Text>
                  )}
                </View>
              </View>

              {/* Conditional win rates */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Conditional win rate</Text>
                <Text style={styles.cardHint}>Your win rate depending on what just happened</Text>
                <StatLine label={`After a win (n=${cwr.afterWin.sample})`} value={fmtPct(cwr.afterWin.rate)} locked={isLocked} />
                <StatLine label={`After a loss (n=${cwr.afterLoss.sample})`} value={fmtPct(cwr.afterLoss.rate)} locked={isLocked} />
                <StatLine label={`After 2 wins (n=${cwr.afterTwoWins.sample})`} value={fmtPct(cwr.afterTwoWins.rate)} locked={isLocked} />
                <StatLine label={`After 2 losses (n=${cwr.afterTwoLosses.sample})`} value={fmtPct(cwr.afterTwoLosses.rate)} locked={isLocked} />
                {!isLocked && cwr.afterWin.rate !== null && cwr.afterLoss.rate !== null && (
                  <View style={styles.insightNote}>
                    <Ionicons name="information-circle-outline" size={moderateScale(16)} color={COLORS.textSecondary} />
                    <Text style={styles.insightNoteText}>
                      {Math.abs(cwr.afterWin.rate - cwr.afterLoss.rate) < 5
                        ? "Your results don't show a meaningful streak pattern — each hand appears close to independent, as expected."
                        : `Your win rate shifts by ${Math.abs(cwr.afterWin.rate - cwr.afterLoss.rate).toFixed(1)} points depending on the previous outcome.`}
                    </Text>
                  </View>
                )}
                <Text style={styles.cardFootnote}>Pushes aren't counted as wins or losses in these rates.</Text>
              </View>

              {isBlackjack && (
                <>
                  {/* Doubling performance */}
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>Doubling performance</Text>
                    <View style={styles.compareRow}>
                      <CompareStat
                        label={`Doubled (n=${dbl.doubled.sample})`}
                        value={fmtPct(dbl.doubled.winRate)}
                        sub={`ROI: ${dbl.doubled.roi !== null ? `${dbl.doubled.roi.toFixed(1)}%` : '—'}`}
                        locked={isLocked}
                      />
                      <CompareStat
                        label={`Not doubled (n=${dbl.notDoubled.sample})`}
                        value={fmtPct(dbl.notDoubled.winRate)}
                        sub={`ROI: ${dbl.notDoubled.roi !== null ? `${dbl.notDoubled.roi.toFixed(1)}%` : '—'}`}
                        locked={isLocked}
                      />
                    </View>
                    <Text style={styles.cardFootnote}>
                      ROI here is return on the units risked in that bucket — a positive doubled ROI means doubling has
                      paid off for you so far, not just that you won those hands more often.
                    </Text>
                  </View>

                  {/* Double-down rate vs. basic strategy benchmark */}
                  {ddr && (
                    <View style={styles.card}>
                      <Text style={styles.cardLabel}>Double-down frequency</Text>
                      <Text style={styles.cardHint}>
                        How often you double, vs. roughly how often basic strategy calls for it
                      </Text>
                      <View style={styles.compareRow}>
                        <CompareStat label={`You (n=${ddr.sample})`} value={`${ddr.rate.toFixed(1)}%`} locked={isLocked} />
                        <CompareStat label="Reference" value={`~${ddr.benchmarkRate}%`} />
                      </View>
                      <Text style={styles.cardFootnote}>
                        {isLocked
                          ? 'Unlock Ante+ to see how your doubling frequency compares to basic strategy.'
                          : ddr.rate < ddr.benchmarkRate - 2
                          ? "You're doubling less often than basic strategy suggests — you may be leaving profitable doubles on the table."
                          : ddr.rate > ddr.benchmarkRate + 4
                          ? "You're doubling noticeably more than basic strategy suggests — worth checking you're only doubling hard 9–11 and strong soft hands."
                          : "That's roughly in the range basic strategy would suggest."}
                      </Text>
                    </View>
                  )}

                  {/* Blackjack frequency */}
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>Natural blackjack rate</Text>
                    <View style={styles.compareRow}>
                      <CompareStat label="Your rate" value={`${bj.actualRate.toFixed(1)}%`} locked={isLocked} />
                      <CompareStat label="Expected" value={`~${bj.expectedRate}%`} />
                    </View>
                    <Text style={styles.cardFootnote}>
                      {isLocked
                        ? "Unlock Ante+ to see whether you're running hot or cold on naturals compared to the baseline."
                        : bj.sample < 30
                        ? `${bj.count} blackjacks out of ${bj.sample} hands — still a small sample, so don't read much into the gap yet.`
                        : Math.abs(bjRateDelta) < 1.5
                        ? `${bj.count} blackjacks out of ${bj.sample} hands — right in line with the expected rate.`
                        : bjRateDelta > 0
                        ? `${bj.count} blackjacks out of ${bj.sample} hands — you're running hot on naturals compared to the baseline.`
                        : `${bj.count} blackjacks out of ${bj.sample} hands — you're running cold on naturals compared to the baseline.`}
                    </Text>
                  </View>
                </>
              )}

              {/* Bet-size tier win rates */}
              {tiers && (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Win rate by bet size</Text>
                  <Text style={styles.cardHint}>Based on your own small / medium / large bet ranges</Text>
                  <StatLine
                    label={`Small (avg ${currencySymbol}${tiers.small.avgBet.toFixed(0)}, n=${tiers.small.sample})`}
                    value={fmtPct(tiers.small.winRate)}
                    locked={isLocked}
                  />
                  <StatLine
                    label={`Medium (avg ${currencySymbol}${tiers.medium.avgBet.toFixed(0)}, n=${tiers.medium.sample})`}
                    value={fmtPct(tiers.medium.winRate)}
                    locked={isLocked}
                  />
                  <StatLine
                    label={`Large (avg ${currencySymbol}${tiers.large.avgBet.toFixed(0)}, n=${tiers.large.sample})`}
                    value={fmtPct(tiers.large.winRate)}
                    locked={isLocked}
                  />
                  <Text style={styles.cardFootnote}>Pushes aren't counted as wins or losses in these rates.</Text>
                </View>
              )}

              {/* Volatility */}
              <View style={styles.card}>
                <View style={styles.riskHeaderRow}>
                  <Text style={styles.cardLabel}>Risk &amp; volatility</Text>
                  {isLocked ? (
                    <SkeletonBar width={56} height={18} />
                  ) : (
                    vol.riskLabel && (
                      <View
                        style={[
                          styles.riskBadge,
                          { backgroundColor: `${riskLabelColor}22`, borderColor: riskLabelColor },
                        ]}
                      >
                        <Text style={[styles.riskBadgeText, { color: riskLabelColor }]}>{vol.riskLabel}</Text>
                      </View>
                    )
                  )}
                </View>
                <Text style={styles.cardHint}>
                  {isLocked
                    ? 'See how consistent your bet sizing and results really are.'
                    : vol.riskLabel
                    ? `Your results typically swing about ${vol.volatilityRatio.toFixed(1)}x your average bet, hand to hand.`
                    : 'Not enough bet variation yet to score this.'}
                </Text>
                <StatLine label="Net result std. deviation" value={`${currencySymbol}${vol.netResultStdDev.toFixed(2)}`} locked={isLocked} />
                <StatLine label="Bet size std. deviation" value={`${currencySymbol}${vol.betSizeStdDev.toFixed(2)}`} locked={isLocked} />
                <StatLine
                  label="Bet sizing consistency"
                  value={vol.betSizeConsistency !== null ? `${vol.betSizeConsistency.toFixed(0)}/100` : '—'}
                  locked={isLocked}
                />
                <Text style={styles.cardFootnote}>
                  Higher net result deviation means bigger swings hand to hand; a higher consistency score means steadier
                  bet sizing.
                </Text>
              </View>

              {/* Bet size after outcome */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Bet size after outcome</Text>
                <StatLine label="After a win" value={`${currencySymbol}${stats.avgBetAfterWin.toFixed(2)}`} locked={isLocked} />
                <StatLine label="After a loss" value={`${currencySymbol}${stats.avgBetAfterLoss.toFixed(2)}`} locked={isLocked} />
                {!isLocked && chasesLosses && (
                  <View style={styles.insightNote}>
                    <Ionicons name="alert-circle-outline" size={moderateScale(16)} color={COLORS.warning} />
                    <Text style={styles.insightNoteText}>
                      You tend to bet {((betSizeDelta / (stats.avgBetAfterWin || 1)) * 100).toFixed(0)}% more after a loss
                      than after a win — a common loss-chasing pattern worth watching.
                    </Text>
                  </View>
                )}
                {!isLocked && disciplinedSizing && (
                  <View style={styles.insightNote}>
                    <Ionicons name="shield-checkmark-outline" size={moderateScale(16)} color={COLORS.success} />
                    <Text style={styles.insightNoteText}>
                      You don't bet bigger after a loss to try to win it back — that's disciplined bet sizing.
                    </Text>
                  </View>
                )}
              </View>

              {/* Day of week */}
              {dow && (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Best &amp; worst days</Text>
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
                  <Text style={styles.cardFootnote}>
                    {dow.best.sessions < 3 || dow.worst.sessions < 3
                      ? 'Average net profit per session on each day — based on very few sessions per day so far, so treat this as a first read, not a rule.'
                      : 'Average net profit per session on each day.'}
                  </Text>
                </View>
              )}

              {/* Session length performance */}
              {lenPerf && (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>Performance by session length</Text>
                  <StatLine
                    label={`Short: ≤10 hands (n=${lenPerf.short.sample})`}
                    value={lenPerf.short.avgNetPerHand !== null ? `${fmtMoney(lenPerf.short.avgNetPerHand)}/hand` : '—'}
                    locked={isLocked}
                  />
                  <StatLine
                    label={`Medium: 11–25 hands (n=${lenPerf.medium.sample})`}
                    value={lenPerf.medium.avgNetPerHand !== null ? `${fmtMoney(lenPerf.medium.avgNetPerHand)}/hand` : '—'}
                    locked={isLocked}
                  />
                  <StatLine
                    label={`Large: 25+ hands (n=${lenPerf.long.sample})`}
                    value={lenPerf.long.avgNetPerHand !== null ? `${fmtMoney(lenPerf.long.avgNetPerHand)}/hand` : '—'}
                    locked={isLocked}
                  />
                  <Text style={styles.cardFootnote}>
                    If longer sessions trend worse, that can be a fatigue or tilt signal worth watching.
                  </Text>
                </View>
              )}

              {/* Copy report */}
              <Tappable
                style={[styles.copyReportBtn, isLocked && styles.copyReportBtnLocked]}
                onPress={handleCopyReport}
                accessibilityRole="button"
                accessibilityLabel="Copy full report"
              >
                <Ionicons
                  name={isLocked ? 'lock-closed' : copied ? 'checkmark-circle' : 'clipboard-outline'}
                  size={moderateScale(18)}
                  color={COLORS.textDark}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.copyReportBtnText}>
                  {isLocked ? 'Unlock Ante+ to copy report' : copied ? 'Copied to clipboard' : 'Copy full report'}
                </Text>
              </Tappable>
              <Text style={styles.copyReportHint}>
                Paste this into a doc or an AI chat to dig into your numbers further. It's a plain-text summary of
                everything on this page — not gambling advice.
              </Text>
            </>
          )}
        </ScrollView>
        {isLocked && (
          <InsightsUnlockCta
            subtitle="Conditional win rates, doubling performance, and leak detection — unlocked with Ante+."
            onPress={() => presentPaywallIfNeeded()}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  contentArea: { flex: 1 },
  scroll: { padding: SPACING.pageHorizontal },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: SPACING.lg,
  },
  emptyTitle: { fontSize: fluidFont(15), fontWeight: '700', color: COLORS.textPrimary, marginTop: 10 },
  emptyText: { fontSize: fluidFont(12), color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: fluidFont(16) },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  leakCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: moderateScale(18),
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    marginBottom: SPACING.md,
  },
  leakEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  leakEyebrow: { fontSize: fluidFont(12), fontWeight: '700', color: COLORS.warning },
  leakTitle: { fontSize: fluidFont(17), fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6, letterSpacing: -0.3 },
  leakDetail: { fontSize: fluidFont(13), color: COLORS.textSecondary, lineHeight: fluidFont(19) },
  leakMoreText: { fontSize: fluidFont(11), color: COLORS.textMuted, marginTop: 10, fontWeight: '600' },

  noLeakCard: { alignItems: 'center', paddingVertical: moderateScale(22) },
  noLeakTitle: { fontSize: fluidFont(15), fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
  noLeakText: { fontSize: fluidFont(12), color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: fluidFont(16) },

  cardLabel: {
    fontSize: fluidFont(13),
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  cardHint: { fontSize: fluidFont(11), color: COLORS.textMuted, marginBottom: 10, lineHeight: fluidFont(15) },
  cardFootnote: { fontSize: fluidFont(11), color: COLORS.textMuted, marginTop: 8, lineHeight: fluidFont(15) },

  streakValue: { fontSize: fluidFont(28), fontWeight: '700', letterSpacing: -0.5 },
  rowCards: { flexDirection: 'row', gap: moderateScale(10), marginBottom: SPACING.md },
  halfCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'space-between',
    minHeight: moderateScale(100),
  },
  halfCardHeader: { minHeight: moderateScale(32), justifyContent: 'flex-start' },
  halfValue: { fontSize: fluidFont(24), fontWeight: '700' },

  compareRow: { flexDirection: 'row', gap: moderateScale(10) },
  insightNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.sm,
    padding: moderateScale(10),
    marginTop: 10,
  },
  insightNoteText: { flex: 1, fontSize: fluidFont(12), color: COLORS.textSecondary, lineHeight: fluidFont(16) },

  outcomeBarRow: {
    flexDirection: 'row',
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    marginTop: 4,
    marginBottom: 12,
  },
  outcomeBarSeg: { height: '100%' },
  outcomeLegendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(14), marginBottom: 4 },
  outcomeLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4) },
  outcomeLegendText: { fontSize: fluidFont(12), color: COLORS.textSecondary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  overviewDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 12 },

  riskHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.xs, borderWidth: 1 },
  riskBadgeText: { fontSize: fluidFont(10), fontWeight: '700', letterSpacing: 0.3 },

  copyReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    marginTop: 8,
  },
  copyReportBtnLocked: { backgroundColor: COLORS.textMuted },
  copyReportBtnText: { color: COLORS.textDark, fontWeight: '700', fontSize: fluidFont(14) },
  copyReportHint: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: fluidFont(15),
    marginTop: 8,
    paddingHorizontal: 8,
  },
});
