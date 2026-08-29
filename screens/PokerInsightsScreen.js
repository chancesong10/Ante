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
import { computePokerInsights } from '../utils/pokerStatsEngine';
import { SkeletonBar, LockedLeakTeaser, InsightsUnlockCta } from '../components/InsightsPaywall';
import AuthGateScreen from '../components/AuthGateScreen';
import StatLine from '../components/InsightStatLine';
import CompareStat from '../components/InsightCompareStat';

// Turns a scored leak object from buildLeakReport into copy. Kept in the
// screen (not the engine) so the engine stays pure numbers, same split
// InsightsScreen.js uses for blackjack. Only ever called when unlocked —
// locked users see LockedLeakTeaser instead, which never touches real
// leak data (e.g. street_leak's title names the actual street).
function getLeakCopy(leak, { fmtMoney, fmtPct }) {
  switch (leak.id) {
    case 'bluff_catching':
      return {
        title: "You're Getting Bluffed Too Often",
        detail: `When you fold and later find out who was right, it's a bluff ${fmtPct(leak.bluffedRate)} of the time (n=${leak.sample}). That's left ${fmtMoney(leak.moneyLeftOnTable)} in pots on the table that you would have won.`,
      };
    case 'street_leak':
      return {
        title: `Your Biggest Leak Is On The ${leak.street}`,
        detail: `${fmtPct(leak.bluffedRate)} of your ${leak.street} folds turned out to be bluffs (n=${leak.sample}) — ${fmtMoney(leak.moneyLeftOnTable)} left on the table on that street alone. Pots are usually biggest by then, so this is where a leak costs the most.`,
      };
    case 'tilt_after_bluff':
      return {
        title: 'Getting Bluffed Puts You On Tilt',
        detail: `Right after a bluffed fold, your very next fold is a bluff again ${fmtPct(leak.afterBluffedRate)} of the time — vs. only ${fmtPct(leak.afterGoodRate)} after a good fold. Getting bluffed once seems to rattle your reads on the next one.`,
      };
    case 'loss_chasing':
      return {
        title: 'You Bet Bigger After Losing',
        detail: `You invest ${fmtMoney(leak.avgInvestmentAfterLoss)} on average right after a losing hand, vs. ${fmtMoney(leak.avgInvestmentAfterWin)} after a winning one — ${leak.pctIncrease.toFixed(0)}% more. That's a classic loss-chasing pattern.`,
      };
    case 'volatility':
      return {
        title: 'Your Results Are Highly Volatile',
        detail: `Your net result per hand swings about ${leak.volatilityRatio.toFixed(1)}x your average investment, hand to hand. Big swings add variance risk on top of whatever skill edge you have.`,
      };
    case 'session_fatigue':
      return {
        title: 'Your Fold Judgment Fades Late In Sessions',
        detail: `In the first half of your sessions, ${fmtPct(leak.firstHalfRate)} of your folds turn out to be bluffs. In the second half, that jumps to ${fmtPct(leak.secondHalfRate)} — a sign fatigue is costing you reads late in the session.`,
      };
    default:
      return { title: 'Leak Detected', detail: '' };
  }
}

export default function PokerInsightsScreen({ navigation }) {
  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$' } = usePreferences();
  const { user } = useAuth();
  const { isPro, presentPaywallIfNeeded } = usePurchases();
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

  const stats = useMemo(() => computePokerInsights(sessionHistory), [sessionHistory]);
  const hasEnoughData = stats.totalHands >= 5;

  const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
  const fmtMoney = (v) => `${v >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(v).toFixed(2)}`;
  const fmtMoneyAbs = (v) => `${currencySymbol}${Math.abs(v).toFixed(2)}`;
  const fmtBB = (v) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} bb`);

  const outcomes = stats.outcomeBreakdown;
  const returns = stats.returnStats;
  const bb = stats.bbStats;
  const fold = stats.foldStats;
  const byStreet = stats.foldsByStreet;
  const postBluff = stats.postBluffPattern;
  const investAfter = stats.investmentAfterOutcome;
  const streaks = stats.streaks;
  const vol = stats.volatility;
  const commitment = stats.commitmentRatio;
  const showdown = stats.showdownStats;
  const fatigue = stats.foldFatigue;
  const dow = stats.dayOfWeekPerformance;
  const lenPerf = stats.sessionLengthPerformance;
  const topLeak = stats.topLeak;

  const betSizeDelta = investAfter.avgInvestmentAfterLoss - investAfter.avgInvestmentAfterWin;
  const chasesLosses = betSizeDelta > 0 && investAfter.sampleAfterLoss >= 3;
  const disciplinedSizing = betSizeDelta <= 0 && investAfter.sampleAfterLoss >= 3;

  const streakColor =
    streaks.currentStreakType === 'up' ? COLORS.success : streaks.currentStreakType === 'down' ? COLORS.danger : COLORS.textPrimary;

  const riskLabelColor =
    vol.riskLabel === 'Low' ? COLORS.success : vol.riskLabel === 'High' ? COLORS.danger : COLORS.warning;

  const [copied, setCopied] = useState(false);

  const buildReportText = () => {
    const lines = [];
    lines.push('ANTE — POKER INSIGHTS REPORT');
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
    lines.push(`Hands logged: ${outcomes.sample}`);
    lines.push(
      `Win / Split / Loss / Fold: ${fmtPct(outcomes.winRate)} / ${fmtPct(outcomes.splitRate)} / ${fmtPct(outcomes.lossRate)} / ${fmtPct(outcomes.foldRate)}`
    );
    lines.push(`Net Result: ${fmtMoney(returns.netProfit)}`);
    lines.push(`Return on Invested: ${returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'}`);
    if (bb) {
      lines.push(`Net (Big Blinds): ${fmtBB(bb.netBB)} — ${bb.bbPer100 >= 0 ? '+' : ''}${bb.bbPer100.toFixed(1)} bb/100 hands`);
    }
    lines.push('');

    lines.push('BLUFF-CATCHER SCORE');
    lines.push(`Folds logged: ${fold.sample} (${fold.bluffed} bluffed / ${fold.goodFold} good folds / ${fold.noShow} no-show)`);
    lines.push(`Bluffed-fold rate: ${fmtPct(fold.bluffedRate)}`);
    lines.push(`Money left on the table: ${fmtMoneyAbs(fold.moneyLeftOnTable)}${fold.moneyLeftOnTableBB !== null ? ` (${fold.moneyLeftOnTableBB.toFixed(1)} bb)` : ''}`);
    lines.push('');

    if (byStreet.length > 0) {
      lines.push('FOLD QUALITY BY STREET');
      byStreet.forEach((s) => {
        lines.push(`${s.street} (n=${s.sample}): ${fmtPct(s.bluffedRate)} bluffed, ${fmtMoneyAbs(s.moneyLeftOnTable)} left on the table`);
      });
      lines.push('');
    }

    if (postBluff.afterBluffed.rate !== null || postBluff.afterGood.rate !== null) {
      lines.push('POST-BLUFF TILT INDEX');
      lines.push(`Bluffed again right after a bluffed fold (n=${postBluff.afterBluffed.sample}): ${fmtPct(postBluff.afterBluffed.rate)}`);
      lines.push(`Bluffed again right after a good fold (n=${postBluff.afterGood.sample}): ${fmtPct(postBluff.afterGood.rate)}`);
      lines.push('');
    }

    if (fatigue) {
      lines.push('SESSION FATIGUE ON FOLD JUDGMENT');
      lines.push(`First half of sessions (n=${fatigue.firstHalf.sample}): ${fmtPct(fatigue.firstHalf.rate)} bluffed`);
      lines.push(`Second half of sessions (n=${fatigue.secondHalf.sample}): ${fmtPct(fatigue.secondHalf.rate)} bluffed`);
      lines.push('');
    }

    lines.push('INVESTMENT AFTER OUTCOME');
    lines.push(`After a winning hand: ${currencySymbol}${investAfter.avgInvestmentAfterWin.toFixed(2)}`);
    lines.push(`After a losing hand: ${currencySymbol}${investAfter.avgInvestmentAfterLoss.toFixed(2)}`);
    lines.push('');

    lines.push('STREAKS');
    lines.push(
      `Current streak: ${streaks.currentStreakType ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'up' ? 'Up' : 'Down'}` : 'None'}`
    );
    lines.push(`Longest up streak: ${streaks.longestUpStreak}`);
    lines.push(`Longest down streak: ${streaks.longestDownStreak}`);
    lines.push('');

    if (showdown.sample > 0) {
      lines.push('SHOWDOWN WIN RATE');
      lines.push(`Won or split at showdown: ${fmtPct(showdown.winOrSplitRate)} (n=${showdown.sample})`);
      lines.push('');
    }

    if (commitment) {
      lines.push('POT COMMITMENT');
      lines.push(`Your share of the average pot: ${commitment.avgCommitmentPct.toFixed(1)}%`);
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
      presentPaywallIfNeeded();
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
      <View style={styles.topNav}>
        <Ionicons
          name="chevron-back"
          size={22}
          color={COLORS.textPrimary}
          onPress={() => navigation.goBack()}
          style={styles.backIcon}
        />
        <Text style={styles.navTitle}>Poker Insights</Text>
        <View style={{ width: 22 }} />
      </View>

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
              Log at least 5 poker hands to unlock bluff-catching, tilt, and leak analytics. Right now you have {stats.totalHands}.
            </Text>
          </View>
        ) : (
          <>
            {/* Leak Spotlight — the headline "why this is worth paying for" card */}
            {isLocked ? (
              <LockedLeakTeaser />
            ) : topLeak ? (
              <View style={[styles.leakCard, SHADOWS.card]}>
                <View style={styles.leakEyebrowRow}>
                  <Ionicons name="warning" size={14} color={COLORS.warning} />
                  <Text style={styles.leakEyebrow}>BIGGEST LEAK DETECTED</Text>
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
                  Your fold judgment, bet sizing, and volatility all look within a healthy range across {outcomes.sample} hands.
                </Text>
              </View>
            )}

            {/* Performance Overview */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>PERFORMANCE OVERVIEW</Text>
              <Text style={styles.cardHint}>Your actual results across {outcomes.sample} hands</Text>

              {isLocked ? (
                <>
                  <View style={styles.outcomeBarRow}>
                    <View style={[styles.outcomeBarSeg, { flex: 1, backgroundColor: COLORS.backgroundSecondary }]} />
                  </View>
                  <View style={styles.outcomeLegendRow}>
                    <SkeletonBar width={70} height={12} />
                    <SkeletonBar width={70} height={12} />
                    <SkeletonBar width={70} height={12} />
                    <SkeletonBar width={70} height={12} />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.outcomeBarRow}>
                    {outcomes.winRate > 0 && <View style={[styles.outcomeBarSeg, { flex: outcomes.winRate, backgroundColor: COLORS.success }]} />}
                    {outcomes.splitRate > 0 && <View style={[styles.outcomeBarSeg, { flex: outcomes.splitRate, backgroundColor: COLORS.accentCyan }]} />}
                    {outcomes.foldRate > 0 && <View style={[styles.outcomeBarSeg, { flex: outcomes.foldRate, backgroundColor: COLORS.textMuted }]} />}
                    {outcomes.lossRate > 0 && <View style={[styles.outcomeBarSeg, { flex: outcomes.lossRate, backgroundColor: COLORS.danger }]} />}
                  </View>

                  <View style={styles.outcomeLegendRow}>
                    <View style={styles.outcomeLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                      <Text style={styles.outcomeLegendText}>Win {fmtPct(outcomes.winRate)}</Text>
                    </View>
                    <View style={styles.outcomeLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.accentCyan }]} />
                      <Text style={styles.outcomeLegendText}>Split {fmtPct(outcomes.splitRate)}</Text>
                    </View>
                    <View style={styles.outcomeLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.textMuted }]} />
                      <Text style={styles.outcomeLegendText}>Fold {fmtPct(outcomes.foldRate)}</Text>
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
                  label="Return on Invested"
                  value={returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'}
                  valueColor={(returns.roi || 0) > 0 ? COLORS.success : (returns.roi || 0) < 0 ? COLORS.danger : COLORS.textPrimary}
                  locked={isLocked}
                />
                <CompareStat label="Avg / Hand" value={returns.avgResultPerHand !== null ? fmtMoney(returns.avgResultPerHand) : '—'} locked={isLocked} />
              </View>

              {bb && (
                <>
                  <View style={styles.overviewDivider} />
                  <View style={styles.proRow}>
                    <Ionicons name="ribbon-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.proRowLabel}>PRO METRIC — RESULTS BY THE BIG BLIND</Text>
                  </View>
                  <View style={styles.compareRow}>
                    <CompareStat
                      label="Net (BB)"
                      value={fmtBB(bb.netBB)}
                      valueColor={bb.netBB > 0 ? COLORS.success : bb.netBB < 0 ? COLORS.danger : COLORS.textPrimary}
                      locked={isLocked}
                    />
                    <CompareStat
                      label="bb / 100 hands"
                      value={`${bb.bbPer100 >= 0 ? '+' : ''}${bb.bbPer100.toFixed(1)}`}
                      valueColor={bb.bbPer100 > 0 ? COLORS.success : bb.bbPer100 < 0 ? COLORS.danger : COLORS.textPrimary}
                      locked={isLocked}
                    />
                    <CompareStat label="Avg Bet (BB)" value={`${bb.avgInvestmentBB.toFixed(1)} bb`} locked={isLocked} />
                  </View>
                  <Text style={styles.cardFootnote}>
                    bb/100 is how serious players compare results across different stakes — a dollar total alone can't do that.
                  </Text>
                </>
              )}
            </View>

            {/* Bluff-Catcher Score */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>BLUFF-CATCHER SCORE</Text>
              <Text style={styles.cardHint}>What your folds turned out to be, once you found out</Text>

              {fold.sample > 0 ? (
                <>
                  {isLocked ? (
                    <>
                      <View style={styles.outcomeBarRow}>
                        <View style={[styles.outcomeBarSeg, { flex: 1, backgroundColor: COLORS.backgroundSecondary }]} />
                      </View>
                      <View style={styles.outcomeLegendRow}>
                        <SkeletonBar width={64} height={12} />
                        <SkeletonBar width={64} height={12} />
                        <SkeletonBar width={64} height={12} />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.outcomeBarRow}>
                        {fold.bluffedRate > 0 && <View style={[styles.outcomeBarSeg, { flex: fold.bluffed, backgroundColor: COLORS.primary }]} />}
                        {fold.goodFold > 0 && <View style={[styles.outcomeBarSeg, { flex: fold.goodFold, backgroundColor: COLORS.success }]} />}
                        {fold.noShow > 0 && <View style={[styles.outcomeBarSeg, { flex: fold.noShow, backgroundColor: COLORS.textMuted }]} />}
                      </View>
                      <View style={styles.outcomeLegendRow}>
                        <View style={styles.outcomeLegendItem}>
                          <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                          <Text style={styles.outcomeLegendText}>Bluffed {fold.bluffed}</Text>
                        </View>
                        <View style={styles.outcomeLegendItem}>
                          <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                          <Text style={styles.outcomeLegendText}>Good Fold {fold.goodFold}</Text>
                        </View>
                        <View style={styles.outcomeLegendItem}>
                          <View style={[styles.legendDot, { backgroundColor: COLORS.textMuted }]} />
                          <Text style={styles.outcomeLegendText}>No-Show {fold.noShow}</Text>
                        </View>
                      </View>
                    </>
                  )}

                  <View style={styles.overviewDivider} />

                  <View style={styles.compareRow}>
                    <CompareStat
                      label={`Bluffed-Fold Rate (n=${fold.judgedSample})`}
                      value={fmtPct(fold.bluffedRate)}
                      valueColor={fold.bluffedRate !== null && fold.bluffedRate > 35 ? COLORS.danger : COLORS.success}
                      locked={isLocked}
                    />
                    <CompareStat
                      label="Money Left On The Table"
                      value={fmtMoneyAbs(fold.moneyLeftOnTable)}
                      valueColor={COLORS.warning}
                      sub={fold.moneyLeftOnTableBB !== null ? `${fold.moneyLeftOnTableBB.toFixed(1)} bb` : undefined}
                      locked={isLocked}
                    />
                  </View>
                  <Text style={styles.cardFootnote}>
                    "Money left on the table" is the pot you'd have collected on every fold that turned out to be a bluff. Judged folds only — no-shows aren't counted either way.
                  </Text>
                </>
              ) : (
                <Text style={styles.cardHint}>No folds logged yet — this fills in once you start tagging folds.</Text>
              )}
            </View>

            {/* Fold Quality by Street */}
            {byStreet.length > 0 && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>FOLD QUALITY BY STREET</Text>
                <Text style={styles.cardHint}>Where your bluff-catching actually breaks down</Text>
                {byStreet.map((s) => (
                  <StatLine
                    key={s.street}
                    label={`${s.street} (n=${s.sample})`}
                    value={s.bluffedRate !== null ? `${fmtPct(s.bluffedRate)} bluffed` : '—'}
                    valueColor={s.bluffedRate !== null && s.bluffedRate > 40 ? COLORS.danger : undefined}
                    locked={isLocked}
                  />
                ))}
                <Text style={styles.cardFootnote}>
                  Later streets carry bigger pots, so a high bluffed rate there costs more than the same rate pre-flop.
                </Text>
              </View>
            )}

            {/* Post-Bluff Tilt Index */}
            {(postBluff.afterBluffed.sample > 0 || postBluff.afterGood.sample > 0) && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>POST-BLUFF TILT INDEX</Text>
                <Text style={styles.cardHint}>Does getting bluffed change your very next fold read?</Text>
                <StatLine label={`Bluffed Again, Right After a Bluff (n=${postBluff.afterBluffed.sample})`} value={fmtPct(postBluff.afterBluffed.rate)} locked={isLocked} />
                <StatLine label={`Bluffed Again, Right After a Good Fold (n=${postBluff.afterGood.sample})`} value={fmtPct(postBluff.afterGood.rate)} locked={isLocked} />
                {!isLocked && postBluff.tiltIndex !== null && (
                  <View style={styles.insightNote}>
                    <Ionicons
                      name={postBluff.tiltIndex > 15 ? 'alert-circle-outline' : 'information-circle-outline'}
                      size={16}
                      color={postBluff.tiltIndex > 15 ? COLORS.warning : COLORS.textSecondary}
                    />
                    <Text style={styles.insightNoteText}>
                      {postBluff.tiltIndex > 15
                        ? `Your bluffed-fold rate jumps ${postBluff.tiltIndex.toFixed(1)} points right after getting bluffed — a real tilt signature worth watching.`
                        : "Getting bluffed doesn't meaningfully change your next fold read — your judgment holds up under pressure."}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Session Fatigue on Fold Judgment */}
            {fatigue && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>SESSION FATIGUE ON FOLD JUDGMENT</Text>
                <Text style={styles.cardHint}>Bluffed-fold rate, first half of your sessions vs. the second half</Text>
                <View style={styles.compareRow}>
                  <CompareStat label={`First Half (n=${fatigue.firstHalf.sample})`} value={fmtPct(fatigue.firstHalf.rate)} locked={isLocked} />
                  <CompareStat label={`Second Half (n=${fatigue.secondHalf.sample})`} value={fmtPct(fatigue.secondHalf.rate)} locked={isLocked} />
                </View>
                {!isLocked && fatigue.fatigueDelta > 15 && (
                  <View style={styles.insightNote}>
                    <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                    <Text style={styles.insightNoteText}>
                      Your fold reads get {fatigue.fatigueDelta.toFixed(1)} points worse in the back half of a session — a fatigue signal worth a break for.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Investment After Outcome (Chasing) */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>INVESTMENT AFTER OUTCOME</Text>
              <StatLine label="After a Winning Hand" value={`${currencySymbol}${investAfter.avgInvestmentAfterWin.toFixed(2)}`} locked={isLocked} />
              <StatLine label="After a Losing Hand" value={`${currencySymbol}${investAfter.avgInvestmentAfterLoss.toFixed(2)}`} locked={isLocked} />
              {!isLocked && chasesLosses && (
                <View style={styles.insightNote}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.insightNoteText}>
                    You invest {((betSizeDelta / (investAfter.avgInvestmentAfterWin || 1)) * 100).toFixed(0)}% more right after losing a hand than after winning one — a loss-chasing pattern worth watching.
                  </Text>
                </View>
              )}
              {!isLocked && disciplinedSizing && (
                <View style={styles.insightNote}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.success} />
                  <Text style={styles.insightNoteText}>You don't bet bigger after losing to try to win it back — that's disciplined sizing.</Text>
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
                    ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'up' ? 'Up' : 'Down'}`
                    : 'None'}
                </Text>
              )}
            </View>

            <View style={styles.rowCards}>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LONGEST UP STREAK</Text>
                {isLocked ? <SkeletonBar width={36} height={20} /> : <Text style={[styles.halfValue, { color: COLORS.success }]}>{streaks.longestUpStreak}</Text>}
              </View>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LONGEST DOWN STREAK</Text>
                {isLocked ? <SkeletonBar width={36} height={20} /> : <Text style={[styles.halfValue, { color: COLORS.danger }]}>{streaks.longestDownStreak}</Text>}
              </View>
            </View>

            {/* Showdown Win Rate */}
            {showdown.sample > 0 && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>SHOWDOWN WIN RATE</Text>
                <Text style={styles.cardHint}>Of the hands you didn't fold, how often you won or chopped</Text>
                <View style={styles.compareRow}>
                  <CompareStat label={`Won or Split (n=${showdown.sample})`} value={fmtPct(showdown.winOrSplitRate)} locked={isLocked} />
                  <CompareStat label="Won Outright" value={String(showdown.wins)} locked={isLocked} />
                  <CompareStat label="Split" value={String(showdown.splits)} locked={isLocked} />
                </View>
              </View>
            )}

            {/* Commitment Ratio */}
            {commitment && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>POT COMMITMENT</Text>
                <Text style={styles.cardHint}>Your share of the average final pot</Text>
                <StatLine label={`Your Investment vs. Pot (n=${commitment.sample})`} value={`${commitment.avgCommitmentPct.toFixed(1)}%`} locked={isLocked} />
                <Text style={styles.cardFootnote}>
                  Higher means you're usually the one driving the betting; lower means you're more often calling into pots others built.
                </Text>
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
                      <Text style={[styles.riskBadgeText, { color: riskLabelColor }]}>{vol.riskLabel.toUpperCase()}</Text>
                    </View>
                  )
                )}
              </View>
              <Text style={styles.cardHint}>
                {isLocked
                  ? 'See how consistent your bet sizing and results really are.'
                  : vol.riskLabel
                  ? `Your results typically swing about ${vol.volatilityRatio.toFixed(1)}x your average investment, hand to hand.`
                  : 'Not enough investment variation yet to score this.'}
              </Text>
              <StatLine label="Net Result Std. Deviation" value={`${currencySymbol}${vol.netResultStdDev.toFixed(2)}`} locked={isLocked} />
              <StatLine label="Investment Std. Deviation" value={`${currencySymbol}${vol.investmentStdDev.toFixed(2)}`} locked={isLocked} />
              <StatLine label="Sizing Consistency" value={vol.investmentConsistency !== null ? `${vol.investmentConsistency.toFixed(0)}/100` : '—'} locked={isLocked} />
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
                <Text style={styles.cardFootnote}>If longer sessions trend worse, that can be a fatigue or tilt signal worth watching.</Text>
              </View>
            )}

            {/* Copy Report */}
            <TouchableOpacity style={[styles.copyReportBtn, SHADOWS.card, isLocked && styles.copyReportBtnLocked]} activeOpacity={0.85} onPress={handleCopyReport}>
              <Ionicons name={isLocked ? 'lock-closed' : copied ? 'checkmark-circle' : 'clipboard-outline'} size={18} color={COLORS.textDark} style={{ marginRight: 8 }} />
              <Text style={styles.copyReportBtnText}>{isLocked ? 'Unlock Pro to Copy Report' : copied ? 'Copied to Clipboard' : 'Copy Full Report'}</Text>
            </TouchableOpacity>
            <Text style={styles.copyReportHint}>
              Paste this into a doc or an AI chat to dig into your numbers further. It's a plain-text summary of everything on this page — not gambling advice.
            </Text>
          </>
        )}
      </ScrollView>
      {isLocked && (
        <InsightsUnlockCta
          subtitle="Your bluff-catcher score, tilt index, and leak detection — unlocked with Ante Pro."
          onPress={() => presentPaywallIfNeeded()}
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
  leakEyebrow: { fontSize: 11, fontWeight: '700', color: COLORS.warning, letterSpacing: 1 },
  leakTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  leakDetail: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  leakMoreText: { fontSize: 11, color: COLORS.textMuted, marginTop: 10, fontWeight: '600' },
  noLeakCard: { alignItems: 'center', paddingVertical: 22 },
  noLeakTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
  noLeakText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  cardLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 4 },
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
  proRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
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
