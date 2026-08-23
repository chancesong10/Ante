import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, getGameColor, getGameColorMuted } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useActiveSession } from '../context/SessionContext';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import GuestModeBanner from '../components/GuestModeBanner';

const renderGameIcon = (gameType, size = 18, color = getGameColor(gameType)) => {
  if (gameType === 'Poker') {
    return <Ionicons name="cash-outline" size={size} color={color} />;
  }
  if (gameType === 'Sports Betting') {
    return <Ionicons name="basketball-outline" size={size} color={color} />;
  }
  if (gameType === 'General') {
    return <Ionicons name="dice-outline" size={size} color={color} />;
  }
  return <MaterialCommunityIcons name="cards" size={size} color={color} />;
};

const LiveDot = () => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[styles.liveDot, { opacity: pulse }]} />;
};

const TIPS = [
  "In Blackjack, always split Aces and 8s.",
  "Never play slots if you want to protect your bankroll.",
  "In Poker, position is just as important as your cards.",
  "Bankroll management is the key to surviving variance.",
  "Don't chase your losses. Take a break if you're tilting.",
  "In Sports Betting, always shop for the best lines.",
  "Double down on 11, unless the dealer is showing an Ace.",
  "Know when to walk away. Set a stop-loss before you play."
];

export default function HomeScreen({ navigation, onOpenAddModal }) {
  const { activeSession, endActiveSession } = useActiveSession();
  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const hour = new Date().getHours();
  let greetingTime = 'Good Evening';
  if (hour < 12) greetingTime = 'Good Morning';
  else if (hour < 18) greetingTime = 'Good Afternoon';

  const firstName = user ? (profile?.username || user?.email?.split('@')[0] || 'Player') : 'Guest';

  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
  const dailyTip = TIPS[dayOfYear % TIPS.length];

  // Dynamic calculations from real session history
  const totalSessions = sessionHistory.length;
  const totalNet = sessionHistory.reduce((sum, s) => sum + (s.netProfit || 0), 0);
  const totalWins = sessionHistory.reduce((sum, s) => sum + (s.wins || 0), 0);
  const totalLosses = sessionHistory.reduce((sum, s) => sum + (s.losses || 0), 0);
  const winRate =
    totalWins + totalLosses > 0
      ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
      : '0.0';

  // Active session live calculations
  const activeHands = activeSession
    ? activeSession.hands.flatMap((r) => (r.type === 'split' ? r.hands : [r]))
    : [];
  const activeNet = activeHands.reduce((sum, h) => sum + (h.netChange || 0), 0);

  const handleStartNewSession = () => {
    if (onOpenAddModal) {
      onOpenAddModal();
    }
  };

  const handleEndSession = () => {
    endActiveSession();
  };

  const handleResumeSession = () => {
    if (!activeSession) return;
    if (activeSession.gameType === 'Poker') {
      navigation.navigate('Poker');
    } else if (activeSession.gameType === 'Sports Betting') {
      navigation.navigate('SportsBetting');
    } else if (activeSession.gameType === 'General') {
      navigation.navigate('GeneralTracker');
    } else {
      navigation.navigate('Blackjack');
    }
  };

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
        {/* Responsive Header with Logo and Brand */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require('../assets/logo_transparent.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandTitle}>ANTE</Text>
              <Text style={styles.headerSubtitle}>Session & Bankroll Tracker</Text>
            </View>
          </View>
        </View>

        {!user && <GuestModeBanner />}

        {/* Greeting */}
        {!!user && (
          <View style={styles.greetingContainer}>
            <Text style={styles.greetingText}>{greetingTime}, {firstName}!</Text>
          </View>
        )}

        {/* Quick Tip Widget */}
        <View style={[styles.tipCard, SHADOWS.card]}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb" size={moderateScale(18)} color={COLORS.primary} />
            <Text style={styles.tipTitle}>Quick Tip</Text>
          </View>
          <Text style={styles.tipText}>{dailyTip}</Text>
        </View>

        {/* ACTIVE SESSION CARD (Rendered whenever a session is active) */}
        {activeSession && (
          <View style={[styles.activeCard, SHADOWS.card]}>
            <View style={styles.activeHeader}>
              <View style={styles.liveBadge}>
                <LiveDot />
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
                          ? COLORS.success
                          : activeNet < 0
                          ? COLORS.danger
                          : COLORS.textPrimary,
                    },
                  ]}
                >
                  {privacyMode
                    ? '••••••'
                    : `${activeNet > 0 ? '+' : activeNet < 0 ? '-' : ''}${currencySymbol}${Math.abs(activeNet).toFixed(2)}`}
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
                onPress={handleResumeSession}
                accessibilityRole="button"
                accessibilityLabel="Resume Session"
              >
                <Ionicons
                  name="play"
                  size={moderateScale(16)}
                  color={COLORS.textDark}
                  style={{ marginRight: moderateScale(6) }}
                />
                <Text style={styles.resumeButtonText}>Resume Session</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.endButton}
                activeOpacity={0.85}
                onPress={handleEndSession}
                accessibilityRole="button"
                accessibilityLabel="End Session"
              >
                <Ionicons
                  name="stop-circle-outline"
                  size={moderateScale(16)}
                  color={COLORS.danger}
                  style={{ marginRight: moderateScale(6) }}
                />
                <Text style={styles.endButtonText}>End Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* OVERALL PERFORMANCE CARD */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.cardHeaderLabel}>TOTAL NET PROFIT</Text>
          <Text
            style={[
              styles.balanceAmount,
              {
                color:
                  totalNet > 0
                    ? COLORS.success
                    : totalNet < 0
                    ? COLORS.danger
                    : COLORS.textPrimary,
              },
            ]}
          >
            {privacyMode
              ? '••••••'
              : `${totalNet > 0 ? '+' : totalNet < 0 ? '-' : ''}${currencySymbol}${Math.abs(totalNet).toFixed(2)}`}
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
                  totalSessions > 0 && { color: COLORS.success },
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
              accessibilityRole="button"
              accessibilityLabel="Start a Session"
            >
              <Ionicons
                name="add"
                size={moderateScale(18)}
                color={COLORS.textDark}
                style={{ marginRight: moderateScale(6) }}
              />
              <Text style={styles.startSessionCtaText}>Start a Session</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* RECENT SESSIONS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {totalSessions > 0 && (
            <TouchableOpacity
              hitSlop={TOUCH_TARGET.hitSlop}
              onPress={() => navigation.navigate('History')}
            >
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          )}
        </View>

        {totalSessions === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="time-outline" size={moderateScale(32)} color={COLORS.textMuted} />
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
                <View
                  style={[
                    styles.sessionIconBox,
                    { backgroundColor: getGameColorMuted(session.gameType) },
                  ]}
                >
                  {renderGameIcon(session.gameType, moderateScale(18))}
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
                            ? COLORS.success
                            : session.netProfit < 0
                            ? COLORS.danger
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {privacyMode
                      ? '••••••'
                      : `${session.netProfit > 0 ? '+' : session.netProfit < 0 ? '-' : ''}${currencySymbol}${Math.abs(session.netProfit).toFixed(2)}`}
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
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.xxs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  headerLogo: {
    width: moderateScale(56),
    height: moderateScale(56),
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: fluidFont(24),
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Greeting & Tips
  greetingContainer: {
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  greetingText: {
    fontSize: fluidFont(20),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  greetingSubtext: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(18),
  },
  tipCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: moderateScale(6),
  },
  tipTitle: {
    fontSize: fluidFont(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tipText: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(18),
    fontStyle: 'italic',
  },

  // Active Session Card
  activeCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentCyanMuted,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: RADIUS.xs,
    gap: moderateScale(6),
  },
  liveDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
    backgroundColor: COLORS.accentCyan,
  },
  liveBadgeText: {
    color: COLORS.accentCyan,
    fontSize: fluidFont(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeGameName: {
    fontSize: fluidFont(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  activeBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  activeLabel: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  activeNetAmount: {
    fontSize: fluidFont(30),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  activeHandsBadge: {
    alignItems: 'flex-end',
  },
  activeHandsNum: {
    fontSize: fluidFont(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
    
    
  },
  activeHandsLabel: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
  },
  activeButtonRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  resumeButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    minHeight: TOUCH_TARGET.minSize,
  },
  resumeButtonText: {
    color: COLORS.textDark,
    fontSize: fluidFont(14),
    fontWeight: '600',
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    minHeight: TOUCH_TARGET.minSize,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  endButtonText: {
    color: COLORS.danger,
    fontSize: fluidFont(13),
    fontWeight: '600',
  },

  // Base Summary Card
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
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  balanceAmount: {
    fontSize: fluidFont(38),
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(8),
    marginTop: SPACING.md,
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
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: fluidFont(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  startSessionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    minHeight: TOUCH_TARGET.minSize,
    marginTop: SPACING.md,
  },
  startSessionCtaText: {
    color: COLORS.textDark,
    fontSize: fluidFont(14),
    fontWeight: '700',
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: fluidFont(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  viewAllText: {
    fontSize: fluidFont(13),
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Empty State
  emptyStateCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyTitle: {
    fontSize: fluidFont(15),
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: fluidFont(16),
  },

  // Sessions List
  sessionsList: {
    gap: SPACING.xs,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: moderateScale(14),
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sessionIconBox: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: fluidFont(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sessionDate: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sessionResult: {
    alignItems: 'flex-end',
  },
  sessionNet: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sessionDuration: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
