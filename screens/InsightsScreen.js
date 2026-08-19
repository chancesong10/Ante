import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import { computeInsights } from '../utils/statsEngine';

export default function InsightsScreen({ route, navigation }) {
  const { gameType } = route.params;
  const { sessionHistory } = useSession();
  const insets = useSafeAreaInsets();

  const stats = computeInsights(sessionHistory, gameType);
  const hasEnoughData = stats.totalHands >= 5;

  const streakColor =
    stats.currentStreakType === 'win'
      ? COLORS.primary
      : stats.currentStreakType === 'loss'
      ? COLORS.danger
      : COLORS.textPrimary;

  const betSizeDelta = stats.avgBetAfterLoss - stats.avgBetAfterWin;
  const chasesLosses = betSizeDelta > 0 && stats.sampleAfterLoss >= 3;

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
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + moderateScale(60) },
        ]}
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
                <Text style={styles.cardLabel}>LONGEST WIN STREAK</Text>
                <Text style={[styles.halfValue, { color: COLORS.primary }]}>
                  {stats.longestWinStreak}
                </Text>
              </View>
              <View style={[styles.halfCard, SHADOWS.card]}>
                <Text style={styles.cardLabel}>LONGEST LOSS STREAK</Text>
                <Text style={[styles.halfValue, { color: COLORS.danger }]}>
                  {stats.longestLossStreak}
                </Text>
              </View>
            </View>

            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>BET SIZING</Text>
              <View style={styles.statRow}>
                <Text style={styles.statRowLabel}>Average Bet</Text>
                <Text style={styles.statRowValue}>${stats.averageBet.toFixed(2)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statRowLabel}>Median Bet</Text>
                <Text style={styles.statRowValue}>${stats.medianBet.toFixed(2)}</Text>
              </View>
            </View>

            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.cardLabel}>BET SIZE AFTER OUTCOME</Text>
              <View style={styles.statRow}>
                <Text style={styles.statRowLabel}>After a Win</Text>
                <Text style={styles.statRowValue}>${stats.avgBetAfterWin.toFixed(2)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statRowLabel}>After a Loss</Text>
                <Text style={styles.statRowValue}>${stats.avgBetAfterLoss.toFixed(2)}</Text>
              </View>

              {chasesLosses && (
                <View style={styles.insightNote}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.insightNoteText}>
                    You tend to bet {(((betSizeDelta) / (stats.avgBetAfterWin || 1)) * 100).toFixed(0)}% more after a loss than after a win.
                  </Text>
                </View>
              )}
            </View>
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
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  streakValue: { fontSize: 28, fontWeight: '900' },
  rowCards: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  halfCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  halfValue: { fontSize: 22, fontWeight: '900' },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statRowLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  statRowValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '800' },
  insightNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  insightNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});