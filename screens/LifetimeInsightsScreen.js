import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import { usePreferences } from '../context/PreferencesContext';
import { computeLifetimeInsights } from '../utils/lifetimeInsightsEngine';
import { SkeletonBar, LockedLeakTeaser, InsightsUnlockCta } from '../components/InsightsPaywall';
import StatLine from '../components/InsightStatLine';
import CompareStat from '../components/InsightCompareStat';

// Turns a scored leak object from buildLeakReport into copy. Kept in the
// screen (not the engine) so the engine stays pure numbers — same split
// used across the other three insights screens. Only ever called when
// unlocked — locked users see LockedLeakTeaser instead, which never
// touches real leak data (e.g. worst_game's title names the actual game).
function getLeakCopy(leak, { fmtMoney, fmtPct }) {
  switch (leak.id) {
    case 'worst_game':
      return {
        title: `${leak.gameType} Is Dragging Down Your Bankroll`,
        detail: `${leak.gameType} averages ${fmtMoney(leak.avgNetPerSession)} per session (n=${leak.sample})${leak.bestGameType ? `, well behind ${leak.bestGameType} at ${fmtMoney(leak.bestAvgNetPerSession)}` : ''}. Worth asking whether that game is actually worth your time right now.`,
      };
    case 'day_of_week_drag':
      return {
        title: `${leak.day}s Are Costing You`,
        detail: `${leak.day} sessions average ${fmtMoney(leak.avgNet)} (n=${leak.sample}), vs. ${fmtMoney(leak.bestAvgNet)} on your best day, ${leak.bestDay}. Could be fatigue, tilt, or just a bad night out — worth noticing either way.`,
      };
    case 'session_length_fatigue':
      return {
        title: 'Your Longer Sessions Run Worse',
        detail: `Short sessions net ${fmtMoney(leak.shortAvgNetPerHand)}/hand (n=${leak.sampleShort}) vs. ${fmtMoney(leak.longAvgNetPerHand)}/hand (n=${leak.sampleLong}) once a session runs long. That's a classic fatigue signature.`,
      };
    case 'volatility':
      return {
        title: 'Your Bankroll Swings Hard, Session to Session',
        detail: `Your session results vary about ${leak.volatilityRatio.toFixed(1)}x their own typical size. That's real variance risk sitting on top of whatever edge you have anywhere you play.`,
      };
    default:
      return { title: 'Leak Detected', detail: '' };
  }
}

const GAME_ICONS = {
  Blackjack: 'albums-outline',
  Poker: 'cash-outline',
  'Sports Betting': 'basketball-outline',
  General: 'dice-outline',
};

export default function LifetimeInsightsScreen({ navigation }) {
  const { sessionHistory } = useSession();
  const { currencySymbol = '$', proUnlocked } = usePreferences();
  const isLocked = !proUnlocked;
  const insets = useSafeAreaInsets();

  const stats = computeLifetimeInsights(sessionHistory);
  const hasEnoughData = stats.totalSessions >= 5;

  const fmtPct = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
  const fmtMoney = (v) => `${v >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(v).toFixed(2)}`;
  const fmtDuration = (minutes) => {
    const total = Math.round(minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const games = stats.gameBreakdown;
  const streaks = stats.sessionStreaks;
  const dow = stats.dayOfWeekPerformance;
  const lenPerf = stats.sessionLengthPerformance;
  const vol = stats.volatility;
  const timePlayed = stats.timePlayed;
  const topLeak = stats.topLeak;

  const streakColor =
    streaks.currentStreakType === 'win' ? COLORS.success : streaks.currentStreakType === 'loss' ? COLORS.danger : COLORS.textPrimary;
  const riskLabelColor =
    vol.riskLabel === 'Low' ? COLORS.success : vol.riskLabel === 'High' ? COLORS.danger : COLORS.warning;

  const [copied, setCopied] = useState(false);

  const buildReportText = () => {
    const lines = [];
    lines.push('ANTE — LIFETIME INSIGHTS REPORT');
    lines.push(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    lines.push('');

    if (topLeak) {
      const copy = getLeakCopy(topLeak, { fmtMoney, fmtPct });
      lines.push('BIGGEST LEAK DETECTED');
      lines.push(copy.title);
      lines.push(copy.detail);
      lines.push('');
    }

    lines.push('OVERVIEW');
    lines.push(`Sessions logged: ${stats.totalSessions}`);
    lines.push(`Lifetime net: ${fmtMoney(stats.netProfit)}`);
    lines.push(`Overall win rate: ${fmtPct(stats.winRate)}`);
    if (timePlayed) {
      lines.push(`Total time played: ${fmtDuration(timePlayed.totalMinutes)} (avg ${fmtDuration(timePlayed.avgMinutesPerSession)}/session)`);
    }
    lines.push('');

    lines.push('PERFORMANCE BY GAME (avg net per session)');
    games.all.forEach((g) => {
      lines.push(`${g.gameType} (n=${g.sessions}): ${fmtMoney(g.avgNetPerSession)}/session, total ${fmtMoney(g.netProfit)}`);
    });
    lines.push('');

    lines.push('SESSION STREAKS');
    lines.push(`Current streak: ${streaks.currentStreakType ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'win' ? 'Winning' : 'Losing'} session${streaks.currentStreakLength !== 1 ? 's' : ''}` : 'None'}`);
    lines.push(`Longest winning streak: ${streaks.longestWinStreak} sessions`);
    lines.push(`Longest losing streak: ${streaks.longestLossStreak} sessions`);
    lines.push('');

    if (dow) {
      lines.push('BEST & WORST DAYS');
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

    lines.push('RISK & VOLATILITY');
    lines.push(`Risk level: ${vol.riskLabel || 'Not enough data'}`);
    lines.push('');

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
        <Text style={styles.navTitle}>Lifetime Insights</Text>
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
              Log at least 5 sessions across any games to unlock cross-game patterns. Right now you have {stats.totalSessions}.
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
                  Your game mix, timing, and volatility all look within a healthy range across {stats.totalSessions} sessions.
                </Text>
              </View>
            )}

            {/* Overview */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>OVERVIEW</Text>
              <Text style={styles.cardHint}>Across every game you've ever logged</Text>
              <View style={styles.compareRow}>
                <CompareStat
                  label="Lifetime Net"
                  value={fmtMoney(stats.netProfit)}
                  valueColor={stats.netProfit > 0 ? COLORS.success : stats.netProfit < 0 ? COLORS.danger : COLORS.textPrimary}
                  locked={isLocked}
                />
                <CompareStat label="Win Rate" value={fmtPct(stats.winRate)} locked={isLocked} />
                <CompareStat label="Sessions" value={String(stats.totalSessions)} locked={isLocked} />
              </View>
              {timePlayed && (
                <>
                  <View style={styles.overviewDivider} />
                  <View style={styles.compareRow}>
                    <CompareStat label="Time Played" value={fmtDuration(timePlayed.totalMinutes)} locked={isLocked} />
                    <CompareStat label="Avg / Session" value={fmtDuration(timePlayed.avgMinutesPerSession)} locked={isLocked} />
                  </View>
                </>
              )}
            </View>

            {/* Performance by Game */}
            {games.all.length > 0 && (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>PERFORMANCE BY GAME</Text>
                <Text style={styles.cardHint}>Average net per session — which game is actually working for you</Text>
                {games.all.map((g) => (
                  <View key={g.gameType} style={styles.gameRow}>
                    <View style={styles.gameRowLeft}>
                      <Ionicons name={GAME_ICONS[g.gameType] || 'ellipse-outline'} size={16} color={COLORS.textSecondary} />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.gameRowTitle}>{g.gameType}</Text>
                        <Text style={styles.gameRowSub}>{g.sessions} session{g.sessions !== 1 ? 's' : ''}</Text>
                      </View>
                    </View>
                    {isLocked ? (
                      <SkeletonBar width={70} height={13} />
                    ) : (
                      <Text
                        style={[
                          styles.gameRowValue,
                          { color: g.avgNetPerSession > 0 ? COLORS.success : g.avgNetPerSession < 0 ? COLORS.danger : COLORS.textPrimary },
                        ]}
                      >
                        {fmtMoney(g.avgNetPerSession)}/session
                      </Text>
                    )}
                  </View>
                ))}
                {!isLocked && games.best && games.worst && games.best.gameType !== games.worst.gameType && (
                  <Text style={styles.cardFootnote}>
                    Best: {games.best.gameType} · Worst: {games.worst.gameType} (minimum 3 sessions to qualify)
                  </Text>
                )}
              </View>
            )}

            {/* Session Streaks */}
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>CURRENT SESSION STREAK</Text>
              {isLocked ? (
                <SkeletonBar width={120} height={26} style={{ marginTop: 4 }} />
              ) : (
                <Text style={[styles.streakValue, { color: streakColor }]}>
                  {streaks.currentStreakType
                    ? `${streaks.currentStreakLength} ${streaks.currentStreakType === 'win' ? 'Winning' : 'Losing'}`
                    : 'None'}
                </Text>
              )}
            </View>

            <View style={styles.rowCards}>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LONGEST WINNING STREAK</Text>
                {isLocked ? <SkeletonBar width={36} height={20} /> : <Text style={[styles.halfValue, { color: COLORS.success }]}>{streaks.longestWinStreak}</Text>}
                <Text style={styles.cardFootnote}>sessions in a row</Text>
              </View>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LONGEST LOSING STREAK</Text>
                {isLocked ? <SkeletonBar width={36} height={20} /> : <Text style={[styles.halfValue, { color: COLORS.danger }]}>{streaks.longestLossStreak}</Text>}
                <Text style={styles.cardFootnote}>sessions in a row</Text>
              </View>
            </View>

            {/* Day of Week */}
            {dow ? (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>BEST & WORST DAYS</Text>
                <Text style={styles.cardHint}>Across every game combined</Text>
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
            ) : (
              <View style={[styles.card, SHADOWS.card, styles.unlockCard]}>
                <Text style={styles.cardLabel}>BEST & WORST DAYS</Text>
                <Text style={styles.unlockText}>
                  All your sessions so far landed on the same day of the week — log sessions on at least one more day to unlock a best-vs-worst comparison.
                </Text>
              </View>
            )}

            {/* Session Length Performance */}
            {lenPerf ? (
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.cardLabel}>PERFORMANCE BY SESSION LENGTH</Text>
                <Text style={styles.cardHint}>Across every game combined</Text>
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
            ) : (
              <View style={[styles.card, SHADOWS.card, styles.unlockCard]}>
                <Text style={styles.cardLabel}>PERFORMANCE BY SESSION LENGTH</Text>
                <Text style={styles.unlockText}>Log at least 3 sessions total to unlock this breakdown.</Text>
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
                  ? 'See how consistent your bankroll really is, session to session.'
                  : vol.riskLabel
                  ? `Your session results typically swing about ${vol.volatilityRatio.toFixed(1)}x their own typical size.`
                  : 'Not enough session variation yet to score this.'}
              </Text>
            </View>

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
          subtitle="Cross-game patterns, session streaks, and leak detection — unlocked with Ante Pro."
          onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })}
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
  leakEyebrow: { fontSize: 11, fontWeight: '800', color: COLORS.warning, letterSpacing: 1 },
  leakTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  leakDetail: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  leakMoreText: { fontSize: 11, color: COLORS.textMuted, marginTop: 10, fontWeight: '600' },
  noLeakCard: { alignItems: 'center', paddingVertical: 22 },
  noLeakTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8 },
  noLeakText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 16 },
  unlockCard: { opacity: 0.85 },
  unlockText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17, marginTop: 4 },
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
  halfValue: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  compareRow: { flexDirection: 'row', gap: 10 },
  overviewDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 12 },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  gameRowLeft: { flexDirection: 'row', alignItems: 'center' },
  gameRowTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  gameRowSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  gameRowValue: { fontSize: 13, fontWeight: '800' },
  riskHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  riskBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
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
  copyReportBtnText: { color: COLORS.textDark, fontWeight: '800', fontSize: 15 },
  copyReportHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 8,
    paddingHorizontal: 8,
  },
});
