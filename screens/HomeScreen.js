import React, { useEffect, useState } from 'react';
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
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, getGameColor } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useActiveSession } from '../context/SessionContext';
import { useSessionEndFx } from '../context/SessionEndFxContext';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import GuestModeBanner from '../components/GuestModeBanner';
import LivePulseDot from '../components/LivePulseDot';
import { GameIconTile } from '../components/GameIcon';
import ActiveSessionsModal from '../components/ActiveSessionsModal';
import { liveNetOf, liveCountOf } from '../components/ActiveSessionSlip';
import { useCommitPress } from '../components/CommitAnimation';
import { useReduceMotion } from '../components/ui';
import { hapticLight } from '../utils/haptics';

// One recent-session row. Plays the same commit beat as the start-session
// sheet's game cards — press-in, the tile flooding with the game's colour, a
// ring rippling out — but hands off to History instead of starting a session.
function RecentSessionCard({
  session,
  reduced,
  screenFocused,
  committing,
  otherCommitting,
  currencySymbol,
  privacyMode,
  onSelect,
  onCommit,
}) {
  const gameColor = getGameColor(session.gameType);
  const { play, reset, flood, containerStyle, ringStyle } = useCommitPress({
    reduced,
    dimmed: otherCommitting,
    onCommit,
  });

  // Home is a tab, so it stays mounted after the hand-off and the tile would
  // otherwise still be flooded when you come back. Clear it once the screen
  // is off view, so returning always finds the card at rest.
  useEffect(() => {
    if (!screenFocused) reset();
  }, [screenFocused, reset]);

  const handlePress = () => {
    hapticLight();
    onSelect();
    play();
  };

  const net = session.netProfit || 0;

  return (
    <Animated.View style={containerStyle}>
      <TouchableOpacity
        style={[styles.sessionCard, SHADOWS.card]}
        activeOpacity={0.9}
        disabled={committing || otherCommitting}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${session.gameType} session in History`}
      >
        <GameIconTile
          gameType={session.gameType}
          size={moderateScale(38)}
          glyph={moderateScale(18)}
          style={styles.sessionIconBox}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: gameColor, opacity: flood, borderRadius: RADIUS.sm },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.commitRing, { borderColor: gameColor }, ringStyle]}
          />
        </GameIconTile>

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
                  net > 0 ? COLORS.success : net < 0 ? COLORS.danger : COLORS.textPrimary,
              },
            ]}
          >
            {privacyMode
              ? '••••••'
              : `${net > 0 ? '+' : net < 0 ? '-' : ''}${currencySymbol}${Math.abs(net).toFixed(2)}`}
          </Text>
          <Text style={styles.sessionDuration}>{session.durationFormatted}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation, onOpenAddModal }) {
  const { activeSessionList, activeSessionCount, endActiveSession } = useActiveSession();
  const { endSessionWithFx } = useSessionEndFx();
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);
  const reduced = useReduceMotion();
  const isFocused = useIsFocused();

  // Which recent-session card is mid-commit, so its siblings step back.
  const [openingId, setOpeningId] = useState(null);

  // Hands off to History with the tapped session flagged, so it can pulse
  // there. `at` is a nonce — tapping the same row twice must re-trigger the
  // highlight, and identical params wouldn't fire History's effect again.
  const openSessionInHistory = (sessionId) => {
    setOpeningId(null);
    navigation.navigate('History', { highlightId: sessionId, highlightAt: Date.now() });
  };
  const { sessionHistory } = useVisibleSessionHistory();
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const hour = new Date().getHours();
  let greetingTime = 'Good Evening';
  if (hour < 12) greetingTime = 'Good Morning';
  else if (hour < 18) greetingTime = 'Good Afternoon';

  const firstName = user ? (profile?.username || user?.email?.split('@')[0] || 'Player') : 'Guest';

  // Dynamic calculations from real session history
  const totalSessions = sessionHistory.length;
  const totalNet = sessionHistory.reduce((sum, s) => sum + (s.netProfit || 0), 0);
  const totalWins = sessionHistory.reduce((sum, s) => sum + (s.wins || 0), 0);
  const totalLosses = sessionHistory.reduce((sum, s) => sum + (s.losses || 0), 0);
  const winRate =
    totalWins + totalLosses > 0
      ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
      : '0.0';

  // Combined live figures across everything running.
  const activeNet = activeSessionList.reduce((sum, s) => sum + liveNetOf(s), 0);
  const activeBetCount = activeSessionList.reduce((sum, s) => sum + liveCountOf(s), 0);

  const resumeSession = (session) => {
    setSessionsModalVisible(false);
    const screen =
      session.gameType === 'Poker'
        ? 'Poker'
        : session.gameType === 'Sports Betting'
        ? 'SportsBetting'
        : session.gameType === 'General'
        ? 'GeneralTracker'
        : 'Blackjack';
    navigation.navigate(screen);
  };

  // General needs a buy-in and cash-out typed in before it has anything to
  // save, and Sports Betting has its own pending-bet confirmation — so for
  // those two the stop button opens the tracker rather than ending blind.
  const endSessionFromList = (session) => {
    setSessionsModalVisible(false);
    if (session.gameType === 'General' || session.gameType === 'Sports Betting') {
      resumeSession(session);
      return;
    }
    endSessionWithFx({
      net: liveNetOf(session),
      gameType: session.gameType,
      onCommit: () => endActiveSession(session.gameType),
    });
  };

  const handleStartNewSession = () => {
    if (onOpenAddModal) {
      onOpenAddModal();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ActiveSessionsModal
        visible={sessionsModalVisible}
        sessions={activeSessionList}
        currencySymbol={currencySymbol}
        privacyMode={privacyMode}
        onClose={() => setSessionsModalVisible(false)}
        onResume={resumeSession}
        onEnd={endSessionFromList}
      />
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
              {!!user && (
                <Text style={styles.greetingText} numberOfLines={1}>
                  {greetingTime}, {firstName}
                </Text>
              )}
            </View>
          </View>
        </View>

        {!user && <GuestModeBanner />}

        {/* Summary of everything running. Tapping opens the full list — one
            card here regardless of how many games are live, so the home
            screen doesn't grow a stack of them. */}
        {activeSessionCount > 0 && (
          <TouchableOpacity
            style={[styles.activeCard, SHADOWS.card]}
            activeOpacity={0.85}
            onPress={() => setSessionsModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`${activeSessionCount} sessions running. Open the list.`}
          >
            <View style={styles.activeHeader}>
              <View style={styles.liveBadge}>
                <LivePulseDot size={moderateScale(6)} />
                <Text style={styles.liveBadgeText}>
                  {activeSessionCount === 1 ? 'SESSION RUNNING' : 'SESSIONS RUNNING'}
                </Text>
              </View>
              <Text style={styles.activeGameName}>
                {activeSessionCount === 1
                  ? activeSessionList[0].gameType
                  : `${activeSessionCount} games`}
              </Text>
            </View>

            <View style={styles.activeBalanceRow}>
              <View>
                <Text style={styles.activeLabel}>
                  {activeSessionCount === 1 ? 'LIVE NET OUTCOME' : 'COMBINED LIVE NET'}
                </Text>
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
                <Text style={styles.activeHandsNum}>{activeBetCount}</Text>
                <Text style={styles.activeHandsLabel}>logged</Text>
              </View>
            </View>

            <View style={styles.activeOpenRow}>
              <Text style={styles.activeOpenText}>
                {activeSessionCount === 1 ? 'View session' : 'View all sessions'}
              </Text>
              <Ionicons name="chevron-forward" size={moderateScale(16)} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>
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

          {/* Quick Action when nothing is running */}
          {activeSessionCount === 0 && (
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
              <RecentSessionCard
                key={session.id}
                session={session}
                reduced={reduced}
                screenFocused={isFocused}
                committing={openingId === session.id}
                otherCommitting={!!openingId && openingId !== session.id}
                currencySymbol={currencySymbol}
                privacyMode={privacyMode}
                onSelect={() => setOpeningId(session.id)}
                onCommit={() => openSessionInHistory(session.id)}
              />
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
  // Wordmark + greeting stack beside the logo and stay inside its height, so
  // the whole header costs one logo's worth of vertical space.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.xxs,
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
  },
  headerLogo: {
    width: moderateScale(44),
    height: moderateScale(44),
  },
  brandTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: fluidFont(19),
    fontWeight: '800',
    letterSpacing: 1.4,
    color: COLORS.textPrimary,
  },
  greetingText: {
    fontSize: fluidFont(12),
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 1,
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
  // "Live" reads red across the whole app (see components/LivePulseDot) —
  // the broadcast/recording convention, and the one colour that can't be
  // confused with a money or brand accent.
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerMuted,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: RADIUS.xs,
    gap: moderateScale(6),
  },
  liveBadgeText: {
    color: COLORS.danger,
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
  activeOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  activeOpenText: {
    fontSize: fluidFont(13),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  // Size and surface come from GameIconTile — this only positions it.
  sessionIconBox: {
    marginRight: SPACING.sm,
  },
  // Ripples out past the tile, so the tile must not clip it.
  commitRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
    borderWidth: 2,
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
