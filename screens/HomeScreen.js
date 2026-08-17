import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { useSession } from '../context/SessionContext';

export default function HomeScreen({ navigation, onOpenAddModal }) {
  const { activeSession, sessionHistory, endActiveSession, startSession } = useSession();

  // Dynamic calculations from real session history
  const totalSessions = sessionHistory.length;
  const totalNet = sessionHistory.reduce((sum, s) => sum + s.netProfit, 0);
  const totalWins = sessionHistory.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = sessionHistory.reduce((sum, s) => sum + s.losses, 0);
  const winRate = (totalWins + totalLosses) > 0
    ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
    : '0.0';

  // Active session live calculations
  const activeHands = activeSession
    ? activeSession.hands.flatMap((r) => (r.type === 'split' ? r.hands : [r]))
    : [];
  const activeNet = activeHands.reduce((sum, h) => sum + (h.netChange || 0), 0);

  const handleStartNewSession = () => {
    if (!activeSession) {
      startSession('Blackjack');
    }
    navigation.navigate('Blackjack');
  };

  const handleEndSession = () => {
    endActiveSession();
  };

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
          <View>
            <Text style={styles.brandTitle}>ANTE</Text>
            <Text style={styles.headerSubtitle}>Session & Bankroll Tracker</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('Analytics')}
          >
            <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ACTIVE SESSION CARD (Rendered whenever a session is active) */}
        {activeSession && (
          <View style={[styles.activeCard, SHADOWS.card]}>
            <View style={styles.activeHeader}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>ACTIVE SESSION</Text>
              </View>
              <Text style={styles.activeGameName}>{activeSession.gameType}</Text>
            </View>

            <View style={styles.activeBalanceRow}>
              <View>
                <Text style={styles.activeLabel}>LIVE NET OUTCOME</Text>
                <Text
                  style={[
                    styles.activeNetAmount,
                    {
                      color:
                        activeNet > 0
                          ? COLORS.primary
                          : activeNet < 0
                          ? COLORS.danger
                          : COLORS.textPrimary,
                    },
                  ]}
                >
                  {activeNet > 0 ? '+' : ''}${activeNet.toFixed(2)}
                </Text>
              </View>
              <View style={styles.activeHandsBadge}>
                <Text style={styles.activeHandsNum}>{activeHands.length}</Text>
                <Text style={styles.activeHandsLabel}>hands logged</Text>
              </View>
            </View>

            {/* Prominent Action Buttons for Active Session */}
            <View style={styles.activeButtonRow}>
              <TouchableOpacity
                style={[styles.resumeButton, SHADOWS.card]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Blackjack')}
              >
                <Ionicons name="play" size={16} color={COLORS.textDark} style={{ marginRight: 6 }} />
                <Text style={styles.resumeButtonText}>Resume Session</Text>
              </TouchableOpacity>

              {/* Prominent End Session Button */}
              <TouchableOpacity
                style={styles.endButton}
                activeOpacity={0.85}
                onPress={handleEndSession}
              >
                <Ionicons
                  name="stop-circle-outline"
                  size={16}
                  color={COLORS.danger}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.endButtonText}>End Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* OVERALL PERFORMANCE CARD (Minimal & Zeroed-out base state) */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.cardHeaderLabel}>TOTAL NET PROFIT</Text>
          <Text
            style={[
              styles.balanceAmount,
              {
                color:
                  totalNet > 0
                    ? COLORS.primary
                    : totalNet < 0
                    ? COLORS.danger
                    : COLORS.textPrimary,
              },
            ]}
          >
            {totalNet > 0 ? '+' : ''}${totalNet.toFixed(2)}
          </Text>

          {/* Key Metrics Row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Sessions</Text>
              <Text style={styles.metricValue}>{totalSessions}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Win Rate</Text>
              <Text
                style={[
                  styles.metricValue,
                  totalSessions > 0 && { color: COLORS.primary },
                ]}
              >
                {winRate}%
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Hands</Text>
              <Text style={styles.metricValue}>
                {sessionHistory.reduce((sum, s) => sum + s.totalHands, 0)}
              </Text>
            </View>
          </View>

          {/* Quick Action when no active session */}
          {!activeSession && (
            <TouchableOpacity
              style={styles.startSessionCta}
              activeOpacity={0.85}
              onPress={handleStartNewSession}
            >
              <Ionicons name="add" size={18} color={COLORS.textDark} style={{ marginRight: 6 }} />
              <Text style={styles.startSessionCtaText}>Start a Session</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* RECENT SESSIONS LIST (Real data or clean minimal empty state) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {totalSessions > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          )}
        </View>

        {totalSessions === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="time-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No Sessions Recorded</Text>
            <Text style={styles.emptySubtitle}>
              Start a live session to track hands and build your history.
            </Text>
          </View>
        ) : (
          <View style={styles.sessionsList}>
            {sessionHistory.slice(0, 4).map((session) => (
              <TouchableOpacity
                key={session.id}
                style={[styles.sessionCard, SHADOWS.card]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('History')}
              >
                <View style={styles.sessionIconBox}>
                  <Ionicons name="game-controller" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle}>{session.gameType} Session</Text>
                  <Text style={styles.sessionDate}>{session.formattedDate}</Text>
                </View>
                <View style={styles.sessionResult}>
                  <Text
                    style={[
                      styles.sessionNet,
                      {
                        color:
                          session.netProfit > 0
                            ? COLORS.primary
                            : session.netProfit < 0
                            ? COLORS.danger
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {session.netProfit > 0 ? '+' : ''}${session.netProfit.toFixed(2)}
                  </Text>
                  <Text style={styles.sessionDuration}>{session.durationFormatted}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // Active Session Card
  activeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginBottom: 16,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  liveBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeGameName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  activeLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  activeNetAmount: {
    fontSize: 32,
    fontWeight: '900',
  },
  activeHandsBadge: {
    alignItems: 'flex-end',
  },
  activeHandsNum: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  activeHandsLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  activeButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resumeButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  resumeButtonText: {
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
  },
  endButtonText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },

  // Base Summary Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
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
  balanceAmount: {
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  startSessionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 16,
  },
  startSessionCtaText: {
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: '800',
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Empty State
  emptyStateCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },

  // Sessions List
  sessionsList: {
    gap: 10,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sessionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sessionDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sessionResult: {
    alignItems: 'flex-end',
  },
  sessionNet: {
    fontSize: 15,
    fontWeight: '800',
  },
  sessionDuration: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});