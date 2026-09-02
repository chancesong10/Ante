import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  AccessibilityInfo,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, getGameColor } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useActiveSession } from '../context/SessionContext';
import { hapticLight, hapticSuccess } from '../utils/haptics';

// Reports the OS "reduce motion" setting and keeps it live. Inlined rather
// than shared so this modal stays self-contained.
function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

// The four live trackers, in display order. `key` is the exact string
// startSession() expects; `renderIcon` takes the glyph colour.
const GAME_CARDS = [
  {
    key: 'Blackjack',
    nav: 'onNavigateToBlackjack',
    title: 'Blackjack Live Tracker',
    description: 'Track bets, doubles, splits, and calculate real-time net profit',
    renderIcon: (c) => <MaterialCommunityIcons name="cards" size={24} color={c} />,
  },
  {
    key: 'Poker',
    nav: 'onNavigateToPoker',
    title: 'Poker Session Tracker',
    description: 'Log your buy-in and cash-out to track your net result',
    renderIcon: (c) => <Ionicons name="cash-outline" size={24} color={c} />,
  },
  {
    key: 'Sports Betting',
    nav: 'onNavigateToSportsBetting',
    title: 'Sports Betting Tracker',
    description: 'Log stake, odds, and outcome — payout calculated automatically',
    renderIcon: (c) => <Ionicons name="basketball-outline" size={24} color={c} />,
  },
  {
    key: 'General',
    nav: 'onNavigateToGeneral',
    title: 'General Tracker',
    description: 'Simple buy-in / cash-out for anything else',
    renderIcon: (c) => <Ionicons name="dice-outline" size={24} color={c} />,
  },
];

// One game row. Owns its entrance stagger and its "commit" beat: press-in,
// the icon tile flooding with the game's colour, and a ring rippling out
// from it — a chip landing on the felt — before it hands off to the tracker.
function GameOptionCard({
  card,
  index,
  visible,
  reduced,
  committing,
  otherCommitting,
  onSelect,
  onCommit,
}) {
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const flood = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const commitTimer = useRef(null);

  const gameColor = getGameColor(card.key);

  // Never let a scheduled hand-off outlive the card (e.g. the user taps a
  // game, then dismisses the sheet before the commit beat finishes).
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  // Entrance / reset when the sheet opens and closes.
  useEffect(() => {
    if (!visible) {
      clearTimeout(commitTimer.current);
      enter.setValue(reduced ? 1 : 0);
      press.setValue(0);
      flood.setValue(0);
      ring.setValue(0);
      dim.setValue(0);
      return undefined;
    }
    if (reduced) {
      enter.setValue(1);
      return undefined;
    }
    enter.setValue(0);
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      delay: index * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [visible, reduced, index, enter, press, flood, ring, dim]);

  // Step back while another card is the one being committed.
  useEffect(() => {
    Animated.timing(dim, {
      toValue: otherCommitting ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [otherCommitting, dim]);

  const handlePress = () => {
    hapticLight();
    onSelect();
    if (reduced) {
      Animated.timing(flood, { toValue: 1, duration: 140, useNativeDriver: true }).start();
      commitTimer.current = setTimeout(onCommit, 140);
      return;
    }
    Animated.parallel([
      Animated.sequence([
        Animated.timing(press, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(press, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(flood, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(ring, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    commitTimer.current = setTimeout(onCommit, 250);
  };

  const cardScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
  const enterTranslate = enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const dimTranslate = dim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const dimOpacity = dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.28, 0] });

  return (
    <Animated.View
      style={{
        opacity: Animated.multiply(enter, dimOpacity),
        transform: [{ translateY: Animated.add(enterTranslate, dimTranslate) }, { scale: cardScale }],
      }}
    >
      <TouchableOpacity
        style={styles.gameOptionCard}
        activeOpacity={0.9}
        disabled={committing || otherCommitting}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Start ${card.title}`}
      >
        <View style={styles.gameIconBox}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: gameColor, opacity: flood, borderRadius: RADIUS.sm },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.commitRing,
              { borderColor: gameColor, opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
          {card.renderIcon(COLORS.primary)}
        </View>
        <View style={styles.gameInfo}>
          <View style={styles.gameTitleRow}>
            <Text style={styles.gameTitle}>{card.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Ready</Text>
            </View>
          </View>
          <Text style={styles.gameDescription}>{card.description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function StartSessionModal({
  visible,
  onClose,
  onNavigateToBlackjack,
  onNavigateToPoker,
  onNavigateToSportsBetting,
  onNavigateToGeneral,
}) {
  const { activeSession, startSession, endActiveSession } = useActiveSession();
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const [committingGame, setCommittingGame] = useState(null);

  // Clear the commit lock whenever the sheet closes so the next open is fresh.
  useEffect(() => {
    if (!visible) setCommittingGame(null);
  }, [visible]);

  const navByKey = {
    onNavigateToBlackjack,
    onNavigateToPoker,
    onNavigateToSportsBetting,
    onNavigateToGeneral,
  };

  // Same order the per-game handlers used before: start, close, navigate.
  const commitAndStart = useCallback(
    (gameKey, navFn) => {
      if (!activeSession) {
        startSession(gameKey);
      }
      onClose();
      if (navFn) navFn();
    },
    [activeSession, startSession, onClose]
  );

  const handleEndSession = () => {
    hapticSuccess();
    endActiveSession();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                {
                  minHeight: Dimensions.get('window').height * 0.75 + insets.bottom,
                  paddingBottom:
                    insets.bottom > 0
                      ? insets.bottom + moderateScale(12)
                      : moderateScale(24),
                },
              ]}
            >
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.sheetTitle}>
                    {activeSession ? 'Session In Progress' : 'Start New Session'}
                  </Text>
                  <Text style={styles.sheetSubtitle}>
                    {activeSession
                      ? 'You have an active session running'
                      : 'Select a game tracker to begin'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>

              {activeSession ? (
                /* Session Active Options */
                <View style={styles.activeContent}>
                  <View style={styles.activeInfoCard}>
                    <View style={styles.livePulseDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeGameTitle}>
                        Active {activeSession.gameType} Session
                      </Text>
                      <Text style={styles.activeGameMeta}>
                        {activeSession.hands.length} hands recorded
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, SHADOWS.card]}
                    activeOpacity={0.8}
                    onPress={() => {
                      hapticLight();
                      onClose();
                      if (activeSession?.gameType === 'Poker') {
                        if (onNavigateToPoker) onNavigateToPoker();
                      } else if (activeSession?.gameType === 'Sports Betting') {
                        if (onNavigateToSportsBetting) onNavigateToSportsBetting();
                      } else if (activeSession?.gameType === 'General') {
                        if (onNavigateToGeneral) onNavigateToGeneral();
                      } else {
                        if (onNavigateToBlackjack) onNavigateToBlackjack();
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Resume Session"
                  >
                    <Ionicons
                      name="play"
                      size={moderateScale(18)}
                      color={COLORS.textDark}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.primaryButtonText}>Resume Session</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.endSessionBtn}
                    activeOpacity={0.8}
                    onPress={handleEndSession}
                    accessibilityRole="button"
                    accessibilityLabel="End Session and Save"
                  >
                    <Ionicons
                      name="stop-circle-outline"
                      size={moderateScale(18)}
                      color={COLORS.danger}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.endSessionText}>End Session & Save to History</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Start New Session Options */
                <View style={styles.newContent}>
                  {GAME_CARDS.map((card, i) => (
                    <GameOptionCard
                      key={card.key}
                      card={card}
                      index={i}
                      visible={visible}
                      reduced={reduced}
                      committing={committingGame === card.key}
                      otherCommitting={!!committingGame && committingGame !== card.key}
                      onSelect={() => setCommittingGame(card.key)}
                      onCommit={() => commitAndStart(card.key, navByKey[card.nav])}
                    />
                  ))}

                  {/* Future games go here as additional cards — greyed out until built */}
                  <View style={[styles.gameOptionCard, styles.gameOptionCardDisabled]}>
                    <View style={[styles.gameIconBox, styles.gameIconBoxDisabled]}>
                      <Ionicons name="hourglass-outline" size={24} color={COLORS.textMuted} />
                    </View>
                    <View style={styles.gameInfo}>
                      <View style={styles.gameTitleRow}>
                        <Text style={[styles.gameTitle, { color: COLORS.textMuted }]}>More games</Text>
                        <View style={styles.badgeMuted}>
                          <Text style={styles.badgeMutedText}>Soon</Text>
                        </View>
                      </View>
                      <Text style={styles.gameDescription}>New trackers are on the way</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
    overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderBottomWidth: 0,
    paddingTop: moderateScale(12),
    paddingHorizontal: SPACING.pageHorizontal,
    minHeight: Dimensions.get('window').height * 0.75,
  },
  handleBar: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontSize: fluidFont(20),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sheetSubtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  closeButton: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  newContent: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  gameOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameIconBox: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    overflow: 'visible',
  },
  commitRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
    borderWidth: 2,
  },
  gameInfo: {
    flex: 1,
    marginRight: 8,
  },
  gameTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameTitle: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  badge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: moderateScale(7),
    paddingVertical: moderateScale(2),
    borderRadius: RADIUS.xs,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: fluidFont(10),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gameDescription: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: fluidFont(16),
  },
  activeContent: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  activeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    gap: SPACING.sm,
  },
  livePulseDot: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    backgroundColor: COLORS.primary,
  },
  activeGameTitle: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeGameMeta: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    minHeight: TOUCH_TARGET.minSize,
  },
  primaryButtonText: {
    color: COLORS.textDark,
    fontSize: fluidFont(15),
    fontWeight: '700',
  },
  endSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    minHeight: TOUCH_TARGET.minSize,
  },
  endSessionText: {
    color: COLORS.danger,
    fontSize: fluidFont(14),
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: TOUCH_TARGET.minSize,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(14),
    fontWeight: '600',
  },
});
