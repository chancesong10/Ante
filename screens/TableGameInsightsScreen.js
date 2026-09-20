import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { usePurchases } from '../context/PurchasesContext';
import { computeTableGameInsights } from '../utils/tableGameStatsEngine';
import { rouletteHouseEdge, baccaratHouseEdge } from '../utils/tableGameOdds';
import { formatAmount, formatNumber } from '../utils/format';
import { SkeletonBar, LockedLeakTeaser, InsightsUnlockCta } from '../components/InsightsPaywall';
import AuthGateScreen from '../components/AuthGateScreen';
import StatLine from '../components/InsightStatLine';
import CompareStat from '../components/InsightCompareStat';
import { NavBar } from '../components/ui';
import { ExpandableSection, ProgressBar, TrendArrow } from '../components/InsightVisuals';
import useHardwareBack from '../components/useHardwareBack';
import useFlash from '../components/useFlash';

// Insights for Roulette and Baccarat, one screen for both (route param
// `gameType`). The two games measure the same thing — the house edge, and
// the three levers a player has over it: which bet, which table, how it's
// sized — so they share an engine (utils/tableGameStatsEngine) and a layout,
// and differ only in the breakdown cards.

// Turns a scored leak into copy. Kept in the screen so the engine stays pure
// numbers — same split as the other insights screens. Only called when
// unlocked; locked users see LockedLeakTeaser, which never touches leak data.
function getLeakCopy(leak, { fmtMoney, fmtDollar, fmtPct }) {
  switch (leak.id) {
    case 'double_zero_wheel':
      return {
        title: 'Double-Zero Wheels Are Doubling Your House Edge',
        detail: `${fmtPct(leak.shareOfWagered)} of your roulette action (${leak.sample} spins) went on double-zero wheels, where every bet carries a 5.26% house edge instead of 2.70%. That cost an expected ${fmtDollar(leak.extraCost)} on its own — same bets, same luck, just a worse wheel.`,
      };
    case 'tie_bets':
      return {
        title: 'Tie Bets Are Your Most Expensive Habit',
        detail: `${fmtPct(leak.shareOfWagered)} of your baccarat action went on Tie, which carries a ${fmtPct(leak.houseEdge)} house edge. Those bets cost an expected ${fmtDollar(leak.expectedCost)}, ${fmtDollar(leak.extraCostVsBanker)} more than the same money on Banker.`,
      };
    case 'martingale':
      return {
        title: 'You Double Up After Losing',
        detail: `After ${leak.opportunities} losing even-money bets, you roughly doubled your next bet ${fmtPct(leak.rate)} of the time${leak.longestChain >= 2 ? `, up to ${leak.longestChain} times in a row` : ''}. That's a Martingale progression. It can't beat the house edge, and one long losing run wipes out every small win it bought.`,
      };
    case 'loss_chasing':
      return {
        title: 'You Bet Bigger After Losing',
        detail: `You bet ${fmtDollar(leak.avgBetAfterLoss)} on average right after a loss, vs. ${fmtDollar(leak.avgBetAfterWin)} after a win — ${leak.pctIncrease.toFixed(0)}% more. That's a classic loss-chasing pattern.`,
      };
    default:
      return { title: 'Leak Detected', detail: '' };
  }
}

// One row of a breakdown: title and result on top, the detail line and a
// share-of-action bar underneath. When locked, both the result and the detail
// are replaced with redacted bars — never rendered and covered.
function BreakdownRow({ title, detail, value, valueColor, share, locked, first }) {
  return (
    <View style={[styles.breakdownRow, !first && styles.breakdownRowDivider]}>
      <View style={styles.breakdownTop}>
        <Text style={styles.breakdownTitle} numberOfLines={1}>
          {title}
        </Text>
        {locked ? (
          <SkeletonBar width={64} height={13} />
        ) : (
          <Text style={[styles.breakdownValue, valueColor && { color: valueColor }]}>{value}</Text>
        )}
      </View>
      {locked ? (
        <SkeletonBar width="70%" height={10} style={{ marginTop: 6 }} />
      ) : (
        <>
          <Text style={styles.breakdownDetail}>{detail}</Text>
          {share !== null && share !== undefined && (
            <View style={styles.shareTrack}>
              <View style={[styles.shareFill, { width: `${Math.max(2, Math.min(100, share))}%` }]} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function TableGameInsightsScreen({ route, navigation }) {
  const gameType = route?.params?.gameType === 'Baccarat' ? 'Baccarat' : 'Roulette';
  const isRoulette = gameType === 'Roulette';
  const unit = isRoulette ? 'spin' : 'hand';

  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$' } = usePreferences();
  const { user } = useAuth();
  const { isPro } = usePurchases();
  const isLocked = !isPro;
  const insets = useSafeAreaInsets();
  const [copied, flashCopied] = useFlash(false);

  useHardwareBack(navigation);

  const stats = useMemo(() => computeTableGameInsights(sessionHistory, gameType), [sessionHistory, gameType]);
  const hasEnoughData = stats.totalHands >= 5;

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
  const fmtEdge = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(2)}%`);
  const fmtMoney = (v) => `${v >= 0 ? '+' : '-'}${currencySymbol}${formatNumber(Math.abs(v))}`;
  const fmtDollar = (v) => `${currencySymbol}${formatNumber(Math.abs(v))}`;
  const fmtWhole = (v) => `${v >= 0 ? '+' : '-'}${currencySymbol}${formatNumber(Math.abs(v), 0)}`;
  const fmtAmount = (v) => `${currencySymbol}${formatAmount(v)}`;
  const toneOf = (v) => (v > 0 ? COLORS.success : v < 0 ? COLORS.danger : COLORS.textPrimary);

  const outcomes = stats.outcomeBreakdown;
  const returns = stats.returnStats;
  const eva = stats.expectedVsActual;
  const betTypes = stats.betTypeStats;
  const wheelMix = stats.wheelMix;
  const sides = stats.sideStats;
  const tieCost = stats.tieBetCost;
  const prog = stats.progression;
  const sizing = stats.betSizeAfterOutcome;
  const streaks = stats.streaks;
  const vol = stats.volatility;
  const dow = stats.dayOfWeekPerformance;
  const lenPerf = stats.sessionLengthPerformance;
  const topLeak = stats.topLeak;

  // A range only happens for roulette spins logged before the wheel was
  // recorded — see calcExpectedVsActual.
  const fmtSpan = (min, max) => (eva && eva.isRange ? `${fmtWhole(min)} to ${fmtWhole(max)}` : fmtMoney(max));
  const spanTone = (min, max) => (min > 0 ? COLORS.success : max < 0 ? COLORS.danger : COLORS.textPrimary);
  const fmtEdgeSpan = (min, max) =>
    eva && eva.isRange ? `${min.toFixed(2)}–${max.toFixed(2)}%` : fmtEdge(max);

  const edgeExplainer = isRoulette
    ? `Every roulette bet carries the same edge: ${fmtEdge(rouletteHouseEdge('single') * 100)} on a single-zero wheel, ${fmtEdge(rouletteHouseEdge('double') * 100)} on double-zero.`
    : `Banker carries ${fmtEdge(baccaratHouseEdge('Banker') * 100)}, Player ${fmtEdge(baccaratHouseEdge('Player') * 100)}, and Tie ${fmtEdge(baccaratHouseEdge('Tie', 8) * 100)} at 8:1 or ${fmtEdge(baccaratHouseEdge('Tie', 9) * 100)} at 9:1.`;

  const betSizeDelta = sizing.avgBetAfterLoss - sizing.avgBetAfterWin;
  const chasesLosses = betSizeDelta > 0 && sizing.sampleAfterLoss >= 3;
  const disciplinedSizing = betSizeDelta <= 0 && sizing.sampleAfterLoss >= 3;

  const streakColor =
    streaks.currentStreakType === 'win' ? COLORS.success : streaks.currentStreakType === 'loss' ? COLORS.danger : COLORS.textPrimary;
  const riskLabelColor =
    vol.riskLabel === 'Low' ? COLORS.success : vol.riskLabel === 'High' ? COLORS.danger : COLORS.warning;

  const wheelTotal = wheelMix ? wheelMix.single.wagered + wheelMix.double.wagered + wheelMix.unknown.wagered : 0;
  const wheelShare = (wagered) => (wheelTotal > 0 ? `${((wagered / wheelTotal) * 100).toFixed(0)}%` : '—');

  const buildReportText = () => {
    const lines = [];
    lines.push(`ANTE — ${gameType.toUpperCase()} INSIGHTS REPORT`);
    lines.push(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push('');

    if (topLeak) {
      const copy = getLeakCopy(topLeak, { fmtMoney, fmtDollar, fmtPct });
      lines.push('BIGGEST LEAK DETECTED');
      lines.push(copy.title);
      lines.push(copy.detail);
      lines.push('');
    }

    lines.push('PERFORMANCE OVERVIEW');
    lines.push(`${isRoulette ? 'Spins' : 'Hands'} logged: ${outcomes.sample}`);
    lines.push(
      isRoulette
        ? `Win / Loss: ${fmtPct(outcomes.winRate)} / ${fmtPct(outcomes.lossRate)}`
        : `Win / Push / Loss: ${fmtPct(outcomes.winRate)} / ${fmtPct(outcomes.pushRate)} / ${fmtPct(outcomes.lossRate)}`
    );
    lines.push(`Net result: ${fmtMoney(returns.netProfit)}`);
    lines.push(`Return on wagered: ${returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'}`);
    lines.push('');

    if (eva) {
      lines.push('YOU VS. THE HOUSE EDGE');
      lines.push(`Total wagered: ${fmtAmount(eva.totalWagered)}`);
      lines.push(`Expected result: ${fmtSpan(eva.expectedNetMin, eva.expectedNetMax)}`);
      lines.push(`Actual result: ${fmtMoney(eva.actualNet)}`);
      lines.push(`Luck: ${fmtSpan(eva.luckMin, eva.luckMax)}`);
      lines.push(`Blended house edge: ${fmtEdgeSpan(eva.houseEdgeMin, eva.houseEdgeMax)}`);
      if (eva.isRange) lines.push(`(${plural(eva.unknownWheelSample, 'spin')} logged before the wheel was recorded are shown as a range.)`);
      lines.push('');
    }

    if (wheelMix) {
      lines.push('WHEEL MIX (share of action)');
      lines.push(`Single 0: ${wheelShare(wheelMix.single.wagered)}`);
      lines.push(`Double 00: ${wheelShare(wheelMix.double.wagered)}`);
      if (wheelMix.unknown.sample > 0) lines.push(`Not recorded: ${wheelShare(wheelMix.unknown.wagered)}`);
      if (wheelMix.double.sample > 0) lines.push(`Extra expected cost of double-zero: ${fmtDollar(wheelMix.extraCostFromDoubleZero)}`);
      lines.push('');
    }

    if (betTypes.length > 0) {
      lines.push('RESULTS BY BET TYPE');
      betTypes.forEach((t) => {
        lines.push(
          `${t.label}: hit ${fmtPct(t.hitRate)} vs. expected ${fmtPct(t.expectedHitRate)}, ${fmtPct(t.shareOfWagered)} of action, net ${fmtMoney(t.net)}`
        );
      });
      lines.push('');
    }

    if (sides.length > 0) {
      lines.push('WHERE YOUR MONEY GOES');
      sides.forEach((s) => {
        lines.push(
          `${s.side}: won ${fmtPct(s.winRate)} of decided hands vs. expected ${fmtPct(s.expectedWinRate)}, ${fmtPct(s.shareOfWagered)} of action, ${fmtEdge(s.houseEdge)} house edge, net ${fmtMoney(s.net)}`
        );
      });
      if (tieCost) {
        lines.push(`Tie bets: ${fmtAmount(tieCost.tieWagered)} wagered, expected cost ${fmtDollar(tieCost.expectedCost)} (${fmtDollar(tieCost.extraCostVsBanker)} more than on Banker)`);
      }
      lines.push('');
    }

    if (prog) {
      lines.push('PROGRESSION BETTING');
      lines.push(`Doubled after a loss: ${fmtPct(prog.rate)}`);
      lines.push(`Longest doubling run: ${prog.longestChain}`);
      lines.push('');
    }

    lines.push('STREAKS');
    lines.push(`Current streak: ${streaks.currentStreakType ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'win' ? 'Win' : 'Loss'}` : 'None'}`);
    lines.push(`Longest win streak: ${streaks.longestWinStreak}`);
    lines.push(`Longest loss streak: ${streaks.longestLossStreak}`);
    lines.push('');

    lines.push('BET SIZE AFTER OUTCOME');
    lines.push(`After a win: ${fmtDollar(sizing.avgBetAfterWin)}`);
    lines.push(`After a loss: ${fmtDollar(sizing.avgBetAfterLoss)}`);
    lines.push('');

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
      lines.push(`Short, ≤10 ${unit}s: ${lenPerf.short.avgNetPerHand !== null ? `${fmtMoney(lenPerf.short.avgNetPerHand)}/${unit}` : '—'}`);
      lines.push(`Medium, 11–25 ${unit}s: ${lenPerf.medium.avgNetPerHand !== null ? `${fmtMoney(lenPerf.medium.avgNetPerHand)}/${unit}` : '—'}`);
      lines.push(`Long, 25+ ${unit}s: ${lenPerf.long.avgNetPerHand !== null ? `${fmtMoney(lenPerf.long.avgNetPerHand)}/${unit}` : '—'}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('This report was generated from data logged in Ante. It is informational only, not gambling or financial advice.');

    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    if (isLocked) {
      navigation.navigate('AntePlus');
      return;
    }
    await Clipboard.setStringAsync(buildReportText());
    flashCopied(true);
  };

  if (!user) {
    return <AuthGateScreen navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <NavBar title={`${gameType} insights`} onBack={() => navigation.goBack()} />

      <View style={styles.contentArea}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + moderateScale(60) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* You vs. the house edge. Deliberately free — rendered for locked
              users too, with real numbers. It's the one figure on this page
              that's useful from the very first session, and a real personal
              number says more about what Ante+ unlocks than placeholders. */}
          {eva && (
            <View style={[styles.card, SHADOWS.card, styles.edgeCard]}>
              <View style={styles.proRow}>
                <Ionicons name="scale-outline" size={13} color={COLORS.primary} />
                <Text style={styles.proRowLabel}>YOU VS. THE HOUSE EDGE</Text>
              </View>
              <Text style={styles.cardHint}>
                What the math expected from {fmtAmount(eva.totalWagered)} wagered across {plural(eva.sample, unit)}, and what actually happened
              </Text>
              <View style={styles.compareRow}>
                <CompareStat
                  label="Expected"
                  value={fmtSpan(eva.expectedNetMin, eva.expectedNetMax)}
                  valueColor={spanTone(eva.expectedNetMin, eva.expectedNetMax)}
                />
                <CompareStat label="Actual" value={fmtMoney(eva.actualNet)} valueColor={toneOf(eva.actualNet)} />
                <CompareStat
                  label="Luck"
                  value={fmtSpan(eva.luckMin, eva.luckMax)}
                  valueColor={spanTone(eva.luckMin, eva.luckMax)}
                />
              </View>
              <Text style={styles.cardFootnote}>
                Your blended house edge is {fmtEdgeSpan(eva.houseEdgeMin, eva.houseEdgeMax)}. {edgeExplainer} Luck is the gap between expected and actual — it evens out over enough {unit}s. The edge doesn't.
              </Text>
              {eva.isRange && (
                <Text style={styles.cardFootnote}>
                  {plural(eva.unknownWheelSample, 'spin')} logged before Ante recorded the wheel, so those are shown as a range between the two wheels.
                </Text>
              )}
            </View>
          )}

          {!hasEnoughData && !isLocked ? (
            <View style={styles.emptyCard}>
              <Ionicons name="analytics-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Not Enough Data Yet</Text>
              <Text style={styles.emptyText}>
                Log at least 5 {gameType} {unit}s to unlock bet breakdowns, progression tracking, and leak detection. Right now you have {stats.totalHands}.
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
                  <Text style={styles.leakTitle}>{getLeakCopy(topLeak, { fmtMoney, fmtDollar, fmtPct }).title}</Text>
                  <Text style={styles.leakDetail}>{getLeakCopy(topLeak, { fmtMoney, fmtDollar, fmtPct }).detail}</Text>
                  {stats.leaks.length > 1 && (
                    <Text style={styles.leakMoreText}>
                      +{stats.leaks.length - 1} more pattern{stats.leaks.length - 1 !== 1 ? 's' : ''} flagged below
                    </Text>
                  )}
                </View>
              ) : (
                <View style={[styles.card, SHADOWS.card, styles.noLeakCard]}>
                  <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
                  <Text style={styles.noLeakTitle}>No Major Leaks Detected</Text>
                  <Text style={styles.noLeakText}>
                    {isRoulette
                      ? `Your wheel choice, bet progression, and sizing all look within a healthy range across ${outcomes.sample} spins.`
                      : `Your Tie exposure, bet progression, and sizing all look within a healthy range across ${outcomes.sample} hands.`}
                  </Text>
                </View>
              )}

              <ExpandableSection title="The Basics" defaultExpanded={true}>
                {isLocked ? (
                  <>
                    <View style={styles.outcomeBarRow}>
                      <View style={[styles.outcomeBarSeg, { flex: 1, backgroundColor: COLORS.backgroundSecondary }]} />
                    </View>
                    <View style={styles.outcomeLegendRow}>
                      <SkeletonBar width={70} height={12} />
                      <SkeletonBar width={70} height={12} />
                      {!isRoulette && <SkeletonBar width={70} height={12} />}
                    </View>
                  </>
                ) : (
                  <>
                    {outcomes.winRate > 0 && <ProgressBar label="Win Rate" valueText={fmtPct(outcomes.winRate)} percent={outcomes.winRate} color={COLORS.success} />}
                    {!isRoulette && outcomes.pushRate > 0 && <ProgressBar label="Push Rate" valueText={fmtPct(outcomes.pushRate)} percent={outcomes.pushRate} color={COLORS.textMuted} />}
                    {outcomes.lossRate > 0 && <ProgressBar label="Loss Rate" valueText={fmtPct(outcomes.lossRate)} percent={outcomes.lossRate} color={COLORS.danger} />}
                  </>
                )}

                <View style={styles.overviewDivider} />

                <TrendArrow trend={returns.netProfit} label="Net Result" valueText={fmtMoney(returns.netProfit)} goodIsUp={true} />
                <TrendArrow trend={returns.roi || 0} label="Return on Wagered" valueText={returns.roi !== null ? `${returns.roi >= 0 ? '+' : ''}${returns.roi.toFixed(1)}%` : '—'} goodIsUp={true} />
                <TrendArrow trend={returns.avgResultPerHand || 0} label={isRoulette ? 'Avg / Spin' : 'Avg / Hand'} valueText={returns.avgResultPerHand !== null ? fmtMoney(returns.avgResultPerHand) : '—'} goodIsUp={true} />
              </ExpandableSection>

              <ExpandableSection title="Your Habits" defaultExpanded={false}>
                {/* Roulette: wheel mix */}
                {isRoulette && wheelMix && (
                  <View style={[styles.card, SHADOWS.card]}>
                    <Text style={styles.cardLabel}>WHEEL MIX</Text>
                    <Text style={styles.cardHint}>Share of your action on each wheel — the one choice that moves roulette's house edge</Text>
                    <View style={styles.compareRow}>
                      <CompareStat label="Single 0" value={wheelShare(wheelMix.single.wagered)} sub="2.70% edge" locked={isLocked} />
                      <CompareStat label="Double 00" value={wheelShare(wheelMix.double.wagered)} sub="5.26% edge" locked={isLocked} />
                      {wheelMix.unknown.sample > 0 && (
                        <CompareStat label="Not recorded" value={wheelShare(wheelMix.unknown.wagered)} sub="older spins" locked={isLocked} />
                      )}
                    </View>
                    {!isLocked && wheelMix.double.sample > 0 && (
                      <View style={styles.insightNote}>
                        <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                        <Text style={styles.insightNoteText}>
                          Your double-zero spins carried an expected {fmtDollar(wheelMix.extraCostFromDoubleZero)} more in house edge than the same bets on a single-zero wheel.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Roulette: results by bet type */}
                {isRoulette && betTypes.length > 0 && (
                  <View style={[styles.card, SHADOWS.card]}>
                    <Text style={styles.cardLabel}>RESULTS BY BET TYPE</Text>
                    <Text style={styles.cardHint}>
                      How often each bet hit against its true odds. A low hit rate on a 35:1 bet is expected, not a leak.
                    </Text>
                    {betTypes.map((t, i) => (
                      <BreakdownRow
                        key={t.id}
                        first={i === 0}
                        title={`${t.label}${t.odds !== null ? ` · ${t.odds}:1` : ''}`}
                        detail={`Hit ${fmtPct(t.hitRate)} · expected ${fmtPct(t.expectedHitRate)} · ${fmtPct(t.shareOfWagered)} of action`}
                        value={fmtMoney(t.net)}
                        valueColor={toneOf(t.net)}
                        share={t.shareOfWagered}
                        locked={isLocked}
                      />
                    ))}
                  </View>
                )}

                {/* Baccarat: where the money goes */}
                {!isRoulette && sides.length > 0 && (
                  <View style={[styles.card, SHADOWS.card]}>
                    <Text style={styles.cardLabel}>WHERE YOUR MONEY GOES</Text>
                    <Text style={styles.cardHint}>
                      Each side against its true odds. A tie pushes Player and Banker bets, so their win rate counts decided hands only.
                    </Text>
                    {sides.map((s, i) => (
                      <BreakdownRow
                        key={s.side}
                        first={i === 0}
                        title={`${s.side} · ${fmtEdge(s.houseEdge)} edge`}
                        detail={`Won ${fmtPct(s.winRate)} · expected ${fmtPct(s.expectedWinRate)} · ${fmtPct(s.shareOfWagered)} of action`}
                        value={fmtMoney(s.net)}
                        valueColor={toneOf(s.net)}
                        share={s.shareOfWagered}
                        locked={isLocked}
                      />
                    ))}
                    {!isLocked && tieCost && (
                      <View style={styles.insightNote}>
                        <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                        <Text style={styles.insightNoteText}>
                          Your {fmtAmount(tieCost.tieWagered)} on Tie carried an expected cost of {fmtDollar(tieCost.expectedCost)}, {fmtDollar(tieCost.extraCostVsBanker)} more than the same money on Banker.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Progression betting */}
                {prog && (
                  <View style={[styles.card, SHADOWS.card]}>
                    <Text style={styles.cardLabel}>PROGRESSION BETTING</Text>
                    <Text style={styles.cardHint}>
                      {isRoulette
                        ? 'How often you roughly doubled an even-money bet right after losing one'
                        : 'How often you roughly doubled a Player or Banker bet right after losing one'}
                    </Text>
                    <View style={styles.compareRow}>
                      <CompareStat label="Doubled After a Loss" value={fmtPct(prog.rate)} locked={isLocked} />
                      <CompareStat label="Longest Doubling Run" value={String(prog.longestChain)} locked={isLocked} />
                    </View>
                    <Text style={styles.cardFootnote}>
                      Doubling after losses (a Martingale) doesn't change the house edge. It swaps lots of small wins for a rare, very large loss when a losing run meets the table limit or your bankroll.
                    </Text>
                  </View>
                )}

                {/* Bet size after outcome */}
                <View style={[styles.card, SHADOWS.card]}>
                  <Text style={styles.cardLabel}>BET SIZE AFTER OUTCOME</Text>
                  <StatLine label="After a Win" value={fmtDollar(sizing.avgBetAfterWin)} locked={isLocked} />
                  <StatLine label="After a Loss" value={fmtDollar(sizing.avgBetAfterLoss)} locked={isLocked} />
                  {!isLocked && chasesLosses && (
                    <View style={styles.insightNote}>
                      <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                      <Text style={styles.insightNoteText}>
                        You bet {((betSizeDelta / (sizing.avgBetAfterWin || 1)) * 100).toFixed(0)}% more right after a loss than after a win — a loss-chasing pattern worth watching.
                      </Text>
                    </View>
                  )}
                  {!isLocked && disciplinedSizing && (
                    <View style={styles.insightNote}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.success} />
                      <Text style={styles.insightNoteText}>You don't bet bigger after a loss to try to win it back — that's disciplined sizing.</Text>
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
                        ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'win' ? 'Win' : 'Loss'}${streaks.currentStreakLength !== 1 ? (streaks.currentStreakType === 'win' ? 's' : 'es') : ''}`
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
              </ExpandableSection>

              <ExpandableSection title="Advanced Stats" defaultExpanded={false}>
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
                      ? 'See how hard your results swing from one bet to the next.'
                      : vol.riskLabel
                      ? `Your results typically swing about ${vol.volatilityRatio.toFixed(1)}x your average bet, ${unit} to ${unit}. ${isRoulette ? 'Inside bets' : 'Tie bets'} swing hard by design, so this measures risk, not a mistake.`
                      : 'Not enough variation yet to score this.'}
                  </Text>
                </View>

                {/* Day of Week */}
                {dow && (
                  <View style={[styles.card, SHADOWS.card]}>
                    <Text style={styles.cardLabel}>BEST & WORST DAYS</Text>
                    <StatLine
                      label={`Best: ${dow.best.day}`}
                      value={fmtMoney(dow.best.avgNet)}
                      valueColor={COLORS.success}
                      locked={isLocked}
                    />
                    <StatLine
                      label={`Worst: ${dow.worst.day}`}
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
                      label={`Short: ≤10 ${unit}s`}
                      value={lenPerf.short.avgNetPerHand !== null ? `${fmtMoney(lenPerf.short.avgNetPerHand)}/${unit}` : '—'}
                      locked={isLocked}
                    />
                    <StatLine
                      label={`Medium: 11–25 ${unit}s`}
                      value={lenPerf.medium.avgNetPerHand !== null ? `${fmtMoney(lenPerf.medium.avgNetPerHand)}/${unit}` : '—'}
                      locked={isLocked}
                    />
                    <StatLine
                      label={`Long: 25+ ${unit}s`}
                      value={lenPerf.long.avgNetPerHand !== null ? `${fmtMoney(lenPerf.long.avgNetPerHand)}/${unit}` : '—'}
                      locked={isLocked}
                    />
                  </View>
                )}
              </ExpandableSection>

              {/* Copy Report */}
              <TouchableOpacity
                style={[styles.copyReportBtn, SHADOWS.card, isLocked && styles.copyReportBtnLocked]}
                activeOpacity={0.85}
                onPress={handleCopyReport}
              >
                <Ionicons
                  name={isLocked ? 'lock-closed' : copied ? 'checkmark-circle' : 'clipboard-outline'}
                  size={18}
                  color={COLORS.textDark}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.copyReportBtnText}>
                  {isLocked ? 'Unlock Ante+ to Copy Report' : copied ? 'Copied to Clipboard' : 'Copy Full Report'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.copyReportHint}>
                Paste this into a doc or an AI chat to dig into your numbers further. It's a plain-text summary of everything on this page — not gambling advice.
              </Text>
            </>
          )}

          </ScrollView>
        {isLocked && (
          <InsightsUnlockCta
            subtitle={
              isRoulette
                ? 'Your wheel mix, results by bet type, progression betting, and leak detection — unlocked with Ante+.'
                : 'Your side-by-side results, Tie bet cost, progression betting, and leak detection — unlocked with Ante+.'
            }
            onPress={() => navigation.navigate('AntePlus')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  contentArea: { flex: 1 },
  scroll: { padding: 16 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 6,
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
  // The free headline gets the same lifted border as other "featured" surfaces.
  edgeCard: { borderColor: COLORS.primaryGlow },
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
  cardHint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 10, lineHeight: 15 },
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
  breakdownRow: { paddingVertical: 10 },
  breakdownRowDivider: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  breakdownTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdownTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginRight: 8 },
  breakdownValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  breakdownDetail: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, lineHeight: 15 },
  shareTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    marginTop: 7,
    overflow: 'hidden',
  },
  shareFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.textMuted },
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
