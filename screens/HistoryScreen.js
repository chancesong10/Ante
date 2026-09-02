import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, LAYOUT, TOUCH_TARGET } from '../constants/layout';
import { netTone, formatMoney } from '../utils/format';
import { Screen, ScreenHeader, Tappable, Rise, useReduceMotion } from '../components/ui';
import { renderGameIcon, GameIconTile } from '../components/GameIcon';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import SwipeableRow from '../components/SwipeableRow';

const GAME_TYPE_ORDER = ['Blackjack', 'Poker', 'Sports Betting', 'General'];

// Per-game vocabulary for the stats strip and expanded list. Blackjack keeps
// the classic win-loss-push record; poker has folds instead of pushes, and a
// sports wager isn't a "hand".
const getSessionTerms = (gameType) => {
  if (gameType === 'Poker') {
    return { unit: 'Hands', recordLabel: 'Record (W-L-F)', recordKind: 'poker' };
  }
  if (gameType === 'Sports Betting') {
    return { unit: 'Bets', recordLabel: 'Record (W-L-P)', recordKind: 'wlp' };
  }
  if (gameType === 'General') {
    return { unit: 'Entries', recordLabel: 'Record (W-L)', recordKind: 'wl' };
  }
  return { unit: 'Hands', recordLabel: 'Record (W-L-P)', recordKind: 'wlp' };
};

const buildRecordText = (item) => {
  const wins = item.wins || 0;
  const losses = item.losses || 0;
  const kind = getSessionTerms(item.gameType).recordKind;
  if (kind === 'poker') {
    const folds = item.folds || 0;
    return `${wins}-${Math.max(0, losses - folds)}-${folds}`;
  }
  if (kind === 'wl') {
    return `${wins}-${losses}`;
  }
  return `${wins}-${losses}-${item.pushes || 0}`;
};

// Same icon set as renderGameIcon, plus a generic one for "All Games" —
// used both on the dropdown trigger and inside its option list.
const renderFilterIcon = (gameType, size = 18, color = COLORS.primary) => {
  if (gameType === 'All') return <Ionicons name="apps-outline" size={size} color={color} />;
  return renderGameIcon(gameType, size, color);
};

const keyExtractor = (item) => String(item.id);
const NEW_ROW_SLIDE = moderateScale(96);

// Slides a freshly-stored session in from the right with a slight arrival
// scale. Transform + opacity only, on the native driver — so it runs on the
// UI thread and can't be stuttered by the JS work of storing the session.
// (The previous version measured the row with an onLayout pass and animated
// its `height` on the JS thread, which is exactly what dropped frames.)
//
// The entrance is held until `ready` — History focused AND the stack
// transition into it finished (see entranceReady below). The row is created
// while you're still leaving the tracker screen, so firing on mount spends
// the 360ms mid-navigation and the row just appears in place.
const AnimatedSessionItem = React.memo(function AnimatedSessionItem({ children, isNew, ready }) {
  const anim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const played = useRef(!isNew);

  useEffect(() => {
    if (played.current || !isNew || !ready) return undefined;
    played.current = true;
    anim.setValue(0);
    // one short settle after the transition reports done, then slide
    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 90);
    return () => clearTimeout(t);
  }, [isNew, ready, anim]);

  if (!isNew) return children;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [NEW_ROW_SLIDE, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
});

// One history row. Memoised so that toggling one row's expansion, or storing
// a new session, doesn't re-render every other row in the list.
const SessionRow = React.memo(function SessionRow({
  session,
  isExpanded,
  onToggle,
  onDelete,
  currencySymbol,
  privacyMode,
}) {
  const isWin = session.netProfit > 0;
  const isBuyInMode = session.mode === 'buyInCashOut';
  const terms = getSessionTerms(session.gameType);
  const recordText = buildRecordText(session);

  const handNet = (value) => (
    <Text style={[styles.handNet, { color: netTone(value) }]}>
      {formatMoney(value, currencySymbol, false)}
    </Text>
  );

  return (
    <SwipeableRow
      onDelete={() => onDelete(session.id)}
      confirmTitle="Delete this session?"
      confirmMessage="This will permanently remove this session and its history. This cannot be undone."
    >
      <View style={styles.card}>
        <Tappable onPress={() => onToggle(session.id)} style={styles.cardHeader}>
          <GameIconTile gameType={session.gameType} style={styles.icon} />

          <View style={styles.sessionMeta}>
            <Text style={styles.gameType}>{session.gameType}</Text>
            <Text style={styles.sessionDateTime}>{session.formattedDate}</Text>
          </View>

          <View style={styles.netContainer}>
            <Text style={[styles.netProfitText, { color: netTone(session.netProfit) }]}>
              {formatMoney(session.netProfit, currencySymbol, privacyMode)}
            </Text>
            <View style={styles.durationRow}>
              <Ionicons name="time-outline" size={moderateScale(12)} color={COLORS.textMuted} />
              <Text style={styles.durationText}>{session.durationFormatted}</Text>
            </View>
          </View>
        </Tappable>

        {!isBuyInMode && (
          <View style={styles.statsStrip}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>{terms.unit}</Text>
              <Text style={styles.statVal}>{session.totalHands}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>{terms.recordLabel}</Text>
              <Text style={styles.statVal}>{recordText}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Win rate</Text>
              <Text style={[styles.statVal, isWin && { color: COLORS.success }]}>
                {session.winRate.toFixed(1)}%
              </Text>
            </View>
          </View>
        )}

        {isBuyInMode && (
          <View style={styles.statsStrip}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Buy-in</Text>
              <Text style={styles.statVal}>
                {privacyMode ? '••••' : `${currencySymbol}${session.buyIn.toFixed(2)}`}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Cash-out</Text>
              <Text style={styles.statVal}>
                {privacyMode ? '••••' : `${currencySymbol}${session.cashOut.toFixed(2)}`}
              </Text>
            </View>
          </View>
        )}

        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.expandedDivider} />

            {isBuyInMode ? (
              <View style={styles.buyInSummary}>
                <Text style={styles.expandedTitle}>Session summary</Text>
                <View style={styles.buyInRow}>
                  <Text style={styles.buyInLabel}>Buy-in</Text>
                  <Text style={styles.buyInValue}>
                    {privacyMode ? '••••' : `${currencySymbol}${session.buyIn.toFixed(2)}`}
                  </Text>
                </View>
                <View style={styles.buyInRow}>
                  <Text style={styles.buyInLabel}>Cash-out</Text>
                  <Text style={styles.buyInValue}>
                    {privacyMode ? '••••' : `${currencySymbol}${session.cashOut.toFixed(2)}`}
                  </Text>
                </View>
                <View style={[styles.buyInRow, styles.buyInTotalRow]}>
                  <Text style={styles.buyInTotalLabel}>Net result</Text>
                  <Text style={[styles.buyInTotalValue, { color: netTone(session.netProfit) }]}>
                    {formatMoney(session.netProfit, currencySymbol, privacyMode)}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.expandedTitle}>
                  Logged {terms.unit.toLowerCase()} ({session.hands.length})
                </Text>
                {session.hands.map((h, idx) => {
                  if (h.type === 'split') {
                    return (
                      <View key={idx} style={styles.splitRowBox}>
                        <Text style={styles.splitRowLabel}>Split pair</Text>
                        {h.hands.map((subHand, sIdx) => (
                          <View key={sIdx} style={styles.handRow}>
                            <Text style={styles.handDetail}>
                              Hand {sIdx + 1}: {currencySymbol}
                              {subHand.bet}
                              {subHand.doubled ? ' (2x)' : ''}
                              {subHand.blackjack ? ' (BJ)' : ''} — {subHand.outcome.toUpperCase()}
                            </Text>
                            {handNet(subHand.netChange)}
                          </View>
                        ))}
                      </View>
                    );
                  }

                  if (session.gameType === 'Poker' || h.gameType === 'Poker') {
                    const posStr = h.position ? ` (${h.position})` : '';
                    const betVal = h.heroInvestment !== undefined ? h.heroInvestment : h.bet;
                    let label = `Hand ${idx + 1}${posStr}: Bet ${currencySymbol}${betVal}`;
                    if (h.outcome === 'win') {
                      label += ` | Pot ${currencySymbol}${h.pot || 0} — WON`;
                    } else if (h.outcome === 'fold') {
                      const foldTag =
                        h.foldReason === 'bluffed'
                          ? ' [BLUFFED]'
                          : h.foldReason === 'good_fold'
                          ? ' [GOOD FOLD]'
                          : '';
                      label += ` (${h.streetFolded || 'Fold'}) — FOLD${foldTag}`;
                    } else if (h.outcome === 'split') {
                      label += ` | Pot ${currencySymbol}${h.pot || 0} — SPLIT (${h.splitCount || 2}W)`;
                    } else {
                      label += ` | Pot ${currencySymbol}${h.pot || 0} — LOST`;
                    }

                    return (
                      <View key={idx} style={styles.handRow}>
                        <Text style={styles.handDetail}>{label}</Text>
                        {handNet(h.netChange)}
                      </View>
                    );
                  }

                  return (
                    <View key={idx} style={styles.handRow}>
                      <Text style={styles.handDetail}>
                        {h.matchup
                          ? `${h.matchup} (${h.betType}): ${currencySymbol}${h.bet} @ ${h.odds > 0 ? '+' : ''}${h.odds} — ${h.outcome.toUpperCase()}`
                          : `${session.gameType === 'Sports Betting' ? 'Bet' : 'Hand'} ${idx + 1}: ${currencySymbol}${h.bet}${h.doubled ? ' (2x)' : ''}${h.blackjack ? ' (BJ)' : ''} — ${h.outcome.toUpperCase()}`}
                      </Text>
                      {handNet(h.netChange)}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}
      </View>
    </SwipeableRow>
  );
});

export default function HistoryScreen({ navigation }) {
  const { sessionHistory, deleteSession } = useVisibleSessionHistory();
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const reduced = useReduceMotion();
  const [gameFilter, setGameFilter] = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [gameFilterModalVisible, setGameFilterModalVisible] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  // True once History is focused AND the stack transition that revealed it
  // has finished — the signal the new-row slide waits on, so it plays with
  // the list settled on screen instead of behind the navigation animation.
  const [entranceReady, setEntranceReady] = useState(false);
  useEffect(() => {
    if (!isFocused) {
      setEntranceReady(false);
      return undefined;
    }
    const markReady = () => setEntranceReady(true);
    const parent = navigation.getParent && navigation.getParent();
    const unsub =
      parent && parent.addListener
        ? parent.addListener('transitionEnd', (e) => {
            if (!e?.data?.closing) markReady();
          })
        : null;
    // Fallback in case no transitionEnd fires (already-settled, or an
    // instant tab switch with no stack transition).
    const safety = setTimeout(markReady, 650);
    return () => {
      if (unsub) unsub();
      clearTimeout(safety);
    };
  }, [isFocused, navigation]);

  const historyCount = useRef(
    sessionHistory.length > 0 && Date.now() - (sessionHistory[0]?.endTime || 0) < 5000
      ? sessionHistory.length - 1
      : sessionHistory.length
  );
  const newlyAddedId = useRef(null);

  if (sessionHistory.length > historyCount.current) {
    newlyAddedId.current = sessionHistory[0]?.id;
    historyCount.current = sessionHistory.length;
  } else if (sessionHistory.length < historyCount.current) {
    historyCount.current = sessionHistory.length;
  }

  useEffect(() => {
    if (newlyAddedId.current && isFocused) {
      const timer = setTimeout(() => {
        newlyAddedId.current = null;
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  useEffect(() => {
    setVisibleCount(10);
  }, [gameFilter, outcomeFilter]);

  // Only show a chip for a game the user actually has sessions for, so the
  // row doesn't fill up with dead filters for games never played.
  const gameTypeOptions = useMemo(() => {
    const present = new Set(sessionHistory.map((s) => s.gameType));
    const ordered = GAME_TYPE_ORDER.filter((g) => present.has(g));
    const extras = [...present].filter((g) => !GAME_TYPE_ORDER.includes(g)).sort();
    return ['All', ...ordered, ...extras];
  }, [sessionHistory]);

  const filteredHistory = useMemo(
    () =>
      sessionHistory.filter((item) => {
        if (gameFilter !== 'All' && item.gameType !== gameFilter) return false;
        if (outcomeFilter === 'Wins') return item.netProfit > 0;
        if (outcomeFilter === 'Losses') return item.netProfit < 0;
        return true;
      }),
    [sessionHistory, gameFilter, outcomeFilter]
  );

  const paginatedHistory = useMemo(
    () => filteredHistory.slice(0, visibleCount),
    [filteredHistory, visibleCount]
  );

  const loadMore = useCallback(() => setVisibleCount((prev) => prev + 10), []);
  const handleToggle = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const renderSessionItem = useCallback(
    ({ item }) => (
      <AnimatedSessionItem isNew={item.id === newlyAddedId.current} ready={entranceReady}>
        <SessionRow
          session={item}
          isExpanded={expandedId === item.id}
          onToggle={handleToggle}
          onDelete={deleteSession}
          currencySymbol={currencySymbol}
          privacyMode={privacyMode}
        />
      </AnimatedSessionItem>
    ),
    [expandedId, entranceReady, handleToggle, deleteSession, currencySymbol, privacyMode]
  );

  const hasSessions = sessionHistory.length > 0;

  return (
    <Screen scroll={false}>
      <Rise index={0} reduced={reduced}>
        <ScreenHeader title="History" subtitle="Every session you've recorded" />
      </Rise>

      {hasSessions && (
        <Rise index={1} reduced={reduced}>
          <Tappable
            style={styles.gameFilterButton}
            onPress={() => setGameFilterModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Filter by game"
          >
            <View style={styles.gameFilterButtonLeft}>
              {renderFilterIcon(gameFilter, moderateScale(16), COLORS.textSecondary)}
              <Text style={styles.gameFilterButtonText}>
                {gameFilter === 'All' ? 'All games' : gameFilter}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={moderateScale(16)} color={COLORS.textMuted} />
          </Tappable>

          <View style={styles.filterRow}>
            {['All', 'Wins', 'Losses'].map((f) => (
              <Tappable
                key={f}
                style={[styles.filterPill, outcomeFilter === f && styles.filterPillActive]}
                onPress={() => setOutcomeFilter(f)}
                accessibilityRole="button"
                accessibilityLabel={`${f} filter`}
              >
                <Text style={[styles.filterPillText, outcomeFilter === f && styles.filterPillTextActive]}>
                  {f}
                </Text>
              </Tappable>
            ))}
          </View>
          <Text style={styles.swipeHint}>Swipe a session to delete</Text>
        </Rise>
      )}

      {hasSessions && filteredHistory.length === 0 && (
        <View style={styles.emptyFilterContainer}>
          <Text style={styles.emptyFilterText}>No sessions match this filter.</Text>
        </View>
      )}

      {!hasSessions ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="time-outline" size={moderateScale(32)} color={COLORS.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No sessions logged</Text>
          <Text style={styles.emptySubtitle}>
            When you end a session it appears here with its timestamp and a full breakdown.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.flex}
          data={paginatedHistory}
          keyExtractor={keyExtractor}
          renderItem={renderSessionItem}
          extraData={expandedId}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={9}
          updateCellsBatchingPeriod={40}
          ListFooterComponent={
            visibleCount >= filteredHistory.length ? null : (
              <Tappable style={styles.loadMoreButton} onPress={loadMore}>
                <Text style={styles.loadMoreText}>See more</Text>
              </Tappable>
            )
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + LAYOUT.scrollTail },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={gameFilterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGameFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setGameFilterModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Filter by game</Text>
                  <Tappable
                    onPress={() => setGameFilterModalVisible(false)}
                    hitSlop={TOUCH_TARGET.hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={moderateScale(22)} color={COLORS.textSecondary} />
                  </Tappable>
                </View>

                {gameTypeOptions.map((g) => {
                  const isSelected = gameFilter === g;
                  return (
                    <Tappable
                      key={g}
                      style={[styles.gameOptionRow, isSelected && styles.gameOptionRowSelected]}
                      onPress={() => {
                        setGameFilter(g);
                        setGameFilterModalVisible(false);
                      }}
                    >
                      <View style={styles.gameOptionIconBox}>
                        {renderFilterIcon(
                          g,
                          moderateScale(18),
                          isSelected ? COLORS.primary : COLORS.textSecondary
                        )}
                      </View>
                      <Text style={[styles.gameOptionText, isSelected && styles.gameOptionTextSelected]}>
                        {g === 'All' ? 'All games' : g}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={moderateScale(20)} color={COLORS.primary} />
                      )}
                    </Tappable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  gameFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(11),
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameFilterButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  gameFilterButtonText: {
    fontSize: fluidFont(13),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: moderateScale(8),
    marginBottom: SPACING.xs,
  },
  filterPill: {
    paddingHorizontal: moderateScale(15),
    paddingVertical: moderateScale(6),
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterPillActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.cardBorderHighlight,
  },
  filterPillText: {
    fontSize: fluidFont(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  swipeHint: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: moderateScale(4),
    marginBottom: SPACING.sm,
  },
  emptyFilterContainer: {
    paddingVertical: moderateScale(40),
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: fluidFont(13),
    color: COLORS.textMuted,
  },
  listContent: {
    gap: SPACING.sm,
    paddingTop: moderateScale(2),
  },
  loadMoreButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: fluidFont(14),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // Session card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  sessionMeta: {
    flex: 1,
  },
  gameType: {
    fontSize: fluidFont(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sessionDateTime: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    marginTop: 2,
  },
  netContainer: {
    alignItems: 'flex-end',
  },
  netProfitText: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  durationText: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
  },

  // Flattened stats strip (hairline, not a nested box)
  statsStrip: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 2,
    backgroundColor: COLORS.cardBorder,
  },
  statLabel: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statVal: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },

  expandedSection: {
    marginTop: SPACING.sm,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginBottom: moderateScale(10),
  },
  expandedTitle: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  handRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: SPACING.sm,
  },
  handDetail: {
    flex: 1,
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
  },
  handNet: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  splitRowBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.xs,
    padding: SPACING.xs,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitRowLabel: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  buyInSummary: {
    gap: 4,
  },
  buyInRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  buyInLabel: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  buyInValue: {
    fontSize: fluidFont(13),
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  buyInTotalRow: {
    marginTop: 4,
    paddingTop: moderateScale(10),
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  buyInTotalLabel: {
    fontSize: fluidFont(14),
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  buyInTotalValue: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: moderateScale(80),
  },
  emptyIcon: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: fluidFont(17),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: fluidFont(19),
  },

  // Filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: fluidFont(17),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  gameOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameOptionRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  gameOptionIconBox: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  gameOptionText: {
    flex: 1,
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  gameOptionTextSelected: {
    color: COLORS.primary,
  },
});
