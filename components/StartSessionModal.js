import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Animated,
  Easing,
  AccessibilityInfo,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, getGameColor } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';
import { useActiveSession } from '../context/SessionContext';
import { useSessionEndFx } from '../context/SessionEndFxContext';
import { usePreferences } from '../context/PreferencesContext';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { sanitizeGameOrder } from '../constants/games';
import ActiveSessionSlip from './ActiveSessionSlip';

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

// The six live trackers, in their default display order — overridden per
// user by the `gameOrder` preference (Profile → Game Order), which
// StartSessionModal sorts these against. `key` is the exact string
// startSession() expects; `renderIcon` takes the glyph colour.
const GAME_CARDS = [
  {
    key: 'Blackjack',
    nav: 'onNavigateToBlackjack',
    title: 'Blackjack Live Tracker',
    description: 'Track bets, doubles, splits, and calculate real-time net profit',
    renderIcon: (c) => <MaterialCommunityIcons name="cards-outline" size={24} color={c} />,
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
    key: 'Roulette',
    nav: 'onNavigateToRoulette',
    title: 'Roulette Tracker',
    description: 'Pick a bet type — straight up, red/black, dozens — odds calculated automatically',
    renderIcon: (c) => <Ionicons name="disc-outline" size={24} color={c} />,
  },
  {
    key: 'Baccarat',
    nav: 'onNavigateToBaccarat',
    title: 'Baccarat Tracker',
    description: 'Bet Player, Banker, or Tie — commission and odds calculated automatically',
    renderIcon: (c) => <MaterialCommunityIcons name="cards-diamond-outline" size={24} color={c} />,
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
  onNavigateToRoulette,
  onNavigateToBaccarat,
  onNavigateToGeneral,
}) {
  const { activeSessionList, activeSessionCount, startSession, endActiveSession } =
    useActiveSession();
  const { endSessionWithFx } = useSessionEndFx();
  const { currencySymbol = '$', privacyMode = false, gameOrder } = usePreferences();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // Sorted per the user's saved order (Profile → Game Order), falling back
  // to GAME_CARDS' own order for anything sanitizeGameOrder couldn't place —
  // there shouldn't be any, but a card silently vanishing because its key
  // fell out of the order is worse than it just appearing at the end.
  const orderedCards = useMemo(() => {
    const order = sanitizeGameOrder(gameOrder);
    const byKey = new Map(GAME_CARDS.map((c) => [c.key, c]));
    const sorted = order.map((key) => byKey.get(key)).filter(Boolean);
    const missing = GAME_CARDS.filter((c) => !order.includes(c.key));
    return [...sorted, ...missing];
  }, [gameOrder]);
  const reduced = useReduceMotion();
  const [committingGame, setCommittingGame] = useState(null);

  // An explicit height, not a maxHeight — the scroll body inside is a
  // flex:1 ScrollView, and Yoga only resolves a flex child's size against a
  // *definite* parent height. A maxHeight-only parent has no definite size
  // of its own (it's sized by its content, which is what it's trying to
  // constrain), so the ScrollView collapsed to zero and the sheet shrank to
  // just its header, pinned to the bottom of the screen. Six game cards plus
  // any running sessions routinely exceed a screen's height anyway, so a
  // fixed height a fixed gap below the status bar is what most opens land on.
  const sheetHeight = windowHeight - insets.top - moderateScale(24);

  // Drag-to-dismiss by the handle bar. Held in a ref, not state, so the
  // gesture reads the latest onClose without the PanResponder (created once
  // below) closing over a stale one.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const dragY = useRef(new Animated.Value(0)).current;

  // Fresh every time the sheet opens, in case it was left mid-drag (dragged
  // partway, then released back to resting) the last time it closed.
  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  const settleOpen = useCallback(() => {
    Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }, [dragY]);

  const dismiss = useCallback(() => {
    Animated.timing(dragY, {
      // However tall the sheet actually is, this clears it off the bottom
      // of the screen — no need to know the exact value.
      toValue: sheetHeight + moderateScale(100),
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onCloseRef.current?.();
    });
  }, [dragY, sheetHeight]);

  // Claims the responder the instant a touch lands in the drag zone, rather
  // than waiting to see real movement first. The handle and title block have
  // no onPress of their own to protect (the close button is a separate
  // sibling, deliberately kept outside this zone), so there's nothing lost
  // by grabbing early — and grabbing late was the actual bug: waiting for
  // onMoveShouldSetPanResponder meant this had to win a negotiation against
  // the sheet's own TouchableWithoutFeedback (which claims on touch-start to
  // keep taps on the sheet from closing it), and that handoff wasn't
  // reliably happening, so the drag frequently just never started.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) dragY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const pastThreshold = gesture.dy > moderateScale(120) || gesture.vy > 0.6;
        if (pastThreshold) dismiss();
        else settleOpen();
      },
      onPanResponderTerminate: settleOpen,
    })
  ).current;

  // Clear the commit lock whenever the sheet closes so the next open is fresh.
  useEffect(() => {
    if (!visible) setCommittingGame(null);
  }, [visible]);

  const navByKey = {
    onNavigateToBlackjack,
    onNavigateToPoker,
    onNavigateToSportsBetting,
    onNavigateToRoulette,
    onNavigateToBaccarat,
    onNavigateToGeneral,
  };

  // Start, close, navigate. `startSession` is a no-op when that game already
  // has a live session, so tapping a running game's card just reopens it.
  const commitAndStart = useCallback(
    (gameKey, navFn) => {
      startSession(gameKey);
      onClose();
      if (navFn) navFn();
    },
    [startSession, onClose]
  );

  const navFor = (gameType) =>
    gameType === 'Poker'
      ? onNavigateToPoker
      : gameType === 'Sports Betting'
      ? onNavigateToSportsBetting
      : gameType === 'Roulette'
      ? onNavigateToRoulette
      : gameType === 'Baccarat'
      ? onNavigateToBaccarat
      : gameType === 'General'
      ? onNavigateToGeneral
      : onNavigateToBlackjack;

  const resumeSession = (session) => {
    hapticLight();
    onClose();
    navFor(session.gameType)?.();
  };

  // General needs both amounts typed in before it has anything to save, and
  // Sports Betting has its own pending-bet confirmation — so for those two
  // the stop button opens the tracker rather than ending blind.
  const endSessionFromList = (session) => {
    hapticSuccess();
    onClose();
    if (session.gameType === 'General' || session.gameType === 'Sports Betting') {
      navFor(session.gameType)?.();
      return;
    }
    const net = (session.hands || [])
      .flatMap((r) => (r.type === 'split' && r.hands ? r.hands : [r]))
      .reduce((sum, h) => sum + (h.netChange || 0), 0);
    endSessionWithFx({
      net,
      gameType: session.gameType,
      onCommit: () => endActiveSession(session.gameType),
    });
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
            <Animated.View
              style={[
                styles.sheetContainer,
                { height: sheetHeight, transform: [{ translateY: dragY }] },
              ]}
            >
              {/* The grabbable area is padded well past the bar's own thin
                  visual bounds, so it's the whole quiet strip at the top of
                  the sheet you can grab — not just the 4px-tall bar itself.
                  Deliberately kept off the header row below: it claims the
                  responder the instant a touch lands (see panResponder), and
                  the close button sits only 8px from the title block with a
                  10px hitSlop reaching back into that gap — sharing the drag
                  zone with anything that close made the close button
                  unreliable, so this stays its own isolated strip instead. */}
              <View {...panResponder.panHandlers} style={styles.dragHandle}>
                <View style={styles.handleBar} />
              </View>

              {/* Header stays outside the scroll body — always visible, never
                  something you have to scroll back up past to close the sheet. */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.sheetTitle}>Start New Session</Text>
                  {activeSessionCount > 0 && (
                    <Text style={styles.sheetSubtitle}>
                      {activeSessionCount === 1
                        ? '1 session already running'
                        : `${activeSessionCount} sessions already running`}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>

              {/* Six game cards plus however many are already running no
                  longer reliably fit in one screen — this scrolls internally
                  now instead of the sheet just growing past the top of the
                  screen (which left the header unreachable and opened on
                  whatever the last card happened to be). */}
              <ScrollView
                style={styles.scrollBody}
                contentContainerStyle={[
                  styles.scrollBodyContent,
                  {
                    paddingBottom:
                      insets.bottom > 0 ? insets.bottom + moderateScale(12) : moderateScale(24),
                  },
                ]}
                showsVerticalScrollIndicator={false}
              >
                {/* Anything already running, listed above the game cards so
                    you can resume one or start a different game from the same
                    place. Tapping a game already running just reopens it —
                    startSession is a no-op when that game has a live session. */}
                {activeSessionList.length > 0 && (
                  <View style={styles.runningBlock}>
                    <Text style={styles.runningLabel}>RUNNING NOW</Text>
                    {activeSessionList.map((s) => (
                      <ActiveSessionSlip
                        key={s.id}
                        session={s}
                        currencySymbol={currencySymbol}
                        privacyMode={privacyMode}
                        onResume={() => resumeSession(s)}
                        onEnd={() => endSessionFromList(s)}
                      />
                    ))}
                  </View>
                )}

                <View style={styles.newContent}>
                  {orderedCards.map((card, i) => (
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
                </View>
              </ScrollView>
            </Animated.View>
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
  },
  scrollBody: {
    // Fills whatever's left of sheetContainer's explicit height once the
    // handle bar and header take theirs — that's what makes the game-card
    // list scroll internally instead of pushing the header off-screen.
    flex: 1,
  },
  scrollBodyContent: {
    flexGrow: 1,
  },
  // The pan responder's touch target — well past the bar's own 4px, so it's
  // actually grabbable rather than requiring pixel-precise aim. Sized more
  // generously than the bar alone needs, since this is now the sheet's only
  // drag zone (see the comment above its usage).
  dragHandle: {
    alignItems: 'center',
    paddingTop: moderateScale(14),
    paddingBottom: moderateScale(20),
  },
  handleBar: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: COLORS.cardBorder,
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
  runningBlock: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  runningLabel: {
    fontSize: fluidFont(11),
    fontWeight: '700',
    letterSpacing: 1.4,
    color: COLORS.textSecondary,
    marginBottom: 2,
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
  gameDescription: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: fluidFont(16),
  },
});
