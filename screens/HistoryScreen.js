import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, getGameColor, getGameColorMuted } from '../constants/theme';
import { moderateScale, TOUCH_TARGET } from '../constants/layout';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences } from '../context/PreferencesContext';
import SwipeableRow from '../components/SwipeableRow';

const GAME_TYPE_ORDER = ['Blackjack', 'Poker', 'Sports Betting', 'General'];

const renderGameIcon = (gameType, size = 18, color = getGameColor(gameType)) => {
  if (gameType === 'Poker') return <Ionicons name="cash-outline" size={size} color={color} />;
  if (gameType === 'Sports Betting') return <Ionicons name="basketball-outline" size={size} color={color} />;
  if (gameType === 'General') return <Ionicons name="dice-outline" size={size} color={color} />;
  return <MaterialCommunityIcons name="cards" size={size} color={color} />;
};

// Same icon set as renderGameIcon, plus a generic one for "All Games" —
// used both on the dropdown trigger and inside its option list.
const renderFilterIcon = (gameType, size = 18, color = COLORS.primary) => {
  if (gameType === 'All') return <Ionicons name="apps-outline" size={size} color={color} />;
  return renderGameIcon(gameType, size, color);
};

export default function HistoryScreen({ navigation }) {
  const { sessionHistory, deleteSession } = useVisibleSessionHistory();
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const insets = useSafeAreaInsets();
  const [gameFilter, setGameFilter] = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [gameFilterModalVisible, setGameFilterModalVisible] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

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

  const filteredHistory = sessionHistory.filter((item) => {
    if (gameFilter !== 'All' && item.gameType !== gameFilter) return false;
    if (outcomeFilter === 'Wins') return item.netProfit > 0;
    if (outcomeFilter === 'Losses') return item.netProfit < 0;
    return true;
  });

  const paginatedHistory = filteredHistory.slice(0, visibleCount);

  const loadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderSessionItem = ({ item }) => {
    const isExpanded = expandedId === item.id;
    const isWin = item.netProfit > 0;
    const isLoss = item.netProfit < 0;
    const isBuyInMode = item.mode === 'buyInCashOut';

    return (
      <SwipeableRow
        onDelete={() => deleteSession(item.id)}
        confirmTitle="Delete this session?"
        confirmMessage="This will permanently remove this session and its history. This cannot be undone."
      >
        <View style={[styles.card, SHADOWS.card]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleExpand(item.id)}
            style={styles.cardHeader}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: getGameColorMuted(item.gameType) },
              ]}
            >
              {renderGameIcon(item.gameType, 18)}
            </View>

            <View style={styles.sessionMeta}>
              <Text style={styles.gameType}>{item.gameType} Session</Text>
              <Text style={styles.sessionDateTime}>{item.formattedDate}</Text>
            </View>

            <View style={styles.netContainer}>
              <Text
                style={[
                  styles.netProfitText,
                  {
                    color: isWin
                      ? COLORS.success
                      : isLoss
                      ? COLORS.danger
                      : COLORS.textPrimary,
                  },
                ]}
              >
                {privacyMode
                  ? '••••••'
                  : `${isWin ? '+' : isLoss ? '-' : ''}${currencySymbol}${Math.abs(item.netProfit).toFixed(2)}`}
              </Text>
              <View style={styles.durationRow}>
                <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.durationText}>{item.durationFormatted}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {!isBuyInMode && (
            <View style={styles.statsStrip}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Hands</Text>
                <Text style={styles.statVal}>{item.totalHands}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Record (W-L-P)</Text>
                <Text style={styles.statVal}>
                  {item.wins}-{item.losses}-{item.pushes}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Win Rate</Text>
                <Text style={[styles.statVal, isWin && { color: COLORS.success }]}>
                  {item.winRate.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}

          {isBuyInMode && (
            <View style={styles.statsStrip}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Buy-In</Text>
                <Text style={styles.statVal}>
                  {privacyMode ? '••••••' : `${currencySymbol}${item.buyIn.toFixed(2)}`}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Cash-Out</Text>
                <Text style={styles.statVal}>
                  {privacyMode ? '••••••' : `${currencySymbol}${item.cashOut.toFixed(2)}`}
                </Text>
              </View>
            </View>
          )}

          {isExpanded && (
            <View style={styles.expandedSection}>
              <View style={styles.expandedDivider} />

              {isBuyInMode ? (
                <View style={styles.buyInSummary}>
                  <Text style={styles.expandedTitle}>Session Summary</Text>
                  <View style={styles.buyInRow}>
                    <Text style={styles.buyInLabel}>Buy-In</Text>
                    <Text style={styles.buyInValue}>
                      {privacyMode ? '••••••' : `${currencySymbol}${item.buyIn.toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={styles.buyInRow}>
                    <Text style={styles.buyInLabel}>Cash-Out</Text>
                    <Text style={styles.buyInValue}>
                      {privacyMode ? '••••••' : `${currencySymbol}${item.cashOut.toFixed(2)}`}
                    </Text>
                  </View>
                  <View style={[styles.buyInRow, styles.buyInTotalRow]}>
                    <Text style={styles.buyInTotalLabel}>Net Result</Text>
                    <Text
                      style={[
                        styles.buyInTotalValue,
                        {
                          color: isWin
                            ? COLORS.success
                            : isLoss
                            ? COLORS.danger
                            : COLORS.textPrimary,
                        },
                      ]}
                    >
                      {privacyMode
                        ? '••••••'
                        : `${isWin ? '+' : isLoss ? '-' : ''}${currencySymbol}${Math.abs(item.netProfit).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.expandedTitle}>Logged Hands ({item.hands.length})</Text>
                  {item.hands.map((h, idx) => {
                    if (h.type === 'split') {
                      return (
                        <View key={idx} style={styles.splitRowBox}>
                          <Text style={styles.splitRowLabel}>Split Pair</Text>
                          {h.hands.map((subHand, sIdx) => (
                            <View key={sIdx} style={styles.handRow}>
                              <Text style={styles.handDetail}>
                                Hand {sIdx + 1}: {currencySymbol}{subHand.bet}
                                {subHand.doubled ? ' (2x)' : ''}
                                {subHand.blackjack ? ' (BJ)' : ''} —{' '}
                                {subHand.outcome.toUpperCase()}
                              </Text>
                              <Text
                                style={[
                                  styles.handNet,
                                  {
                                    color:
                                      subHand.netChange > 0
                                        ? COLORS.success
                                        : subHand.netChange < 0
                                        ? COLORS.danger
                                        : COLORS.textPrimary,
                                  },
                                ]}
                              >
                                {subHand.netChange > 0 ? '+' : subHand.netChange < 0 ? '-' : ''}{currencySymbol}
                                {Math.abs(subHand.netChange).toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    }

                    if (item.gameType === 'Poker' || h.gameType === 'Poker') {
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
                          <Text
                            style={[
                              styles.handNet,
                              {
                                color:
                                  h.netChange > 0
                                    ? COLORS.success
                                    : h.netChange < 0
                                    ? COLORS.danger
                                    : COLORS.textPrimary,
                              },
                            ]}
                          >
                            {h.netChange > 0 ? '+' : h.netChange < 0 ? '-' : ''}{currencySymbol}
                            {Math.abs(h.netChange).toFixed(2)}
                          </Text>
                        </View>
                      );
                    }

                    return (
                      <View key={idx} style={styles.handRow}>
                        <Text style={styles.handDetail}>
                          {h.matchup
                            ? `${h.matchup} (${h.betType}): ${currencySymbol}${h.bet} @ ${h.odds > 0 ? '+' : ''}${h.odds} — ${h.outcome.toUpperCase()}`
                            : `Hand ${idx + 1}: ${currencySymbol}${h.bet}${h.doubled ? ' (2x)' : ''}${h.blackjack ? ' (BJ)' : ''} — ${h.outcome.toUpperCase()}`}
                        </Text>
                        <Text
                          style={[
                            styles.handNet,
                            {
                              color:
                                h.netChange > 0
                                  ? COLORS.success
                                  : h.netChange < 0
                                  ? COLORS.danger
                                  : COLORS.textPrimary,
                            },
                          ]}
                        >
                          {h.netChange > 0 ? '+' : h.netChange < 0 ? '-' : ''}{currencySymbol}{Math.abs(h.netChange).toFixed(2)}
                        </Text>
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
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>Recorded live game sessions</Text>
          </View>
        </View>

        {sessionHistory.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.gameFilterButton}
              activeOpacity={0.8}
              onPress={() => setGameFilterModalVisible(true)}
            >
              <View style={styles.gameFilterButtonLeft}>
                {renderFilterIcon(gameFilter, 16, COLORS.primary)}
                <Text style={styles.gameFilterButtonText}>
                  {gameFilter === 'All' ? 'All Games' : gameFilter}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.filterRow, styles.filterRowSecondary]}>
              {['All', 'Wins', 'Losses'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, styles.filterPillSecondary, outcomeFilter === f && styles.filterPillActive]}
                  onPress={() => setOutcomeFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      outcomeFilter === f && styles.filterPillTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.swipeHint}>Swipe a session to delete</Text>
          </>
        )}

        {sessionHistory.length > 0 && filteredHistory.length === 0 && (
          <View style={styles.emptyFilterContainer}>
            <Text style={styles.emptyFilterText}>No sessions match this filter.</Text>
          </View>
        )}

        {sessionHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="time-outline" size={36} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Sessions Logged</Text>
            <Text style={styles.emptySubtitle}>
              When you complete and end a session, it will automatically appear here with relative timestamps and detailed statistics.
            </Text>
          </View>
        ) : (
          <FlatList
            data={paginatedHistory}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderSessionItem}
            ListFooterComponent={() => {
              if (visibleCount >= filteredHistory.length) return null;
              return (
                <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
                  <Text style={styles.loadMoreText}>See More</Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + moderateScale(96) },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal
        visible={gameFilterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGameFilterModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setGameFilterModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalSheet, SHADOWS.card]}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Filter by Game</Text>
                <TouchableOpacity
                  onPress={() => setGameFilterModalVisible(false)}
                  hitSlop={TOUCH_TARGET.hitSlop}
                >
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {gameTypeOptions.map((g) => {
                const isSelected = gameFilter === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gameOptionRow, isSelected && styles.gameOptionRowSelected]}
                    onPress={() => {
                      setGameFilter(g);
                      setGameFilterModalVisible(false);
                    }}
                  >
                    <View style={styles.gameOptionIconBox}>
                      {renderFilterIcon(g, 18, isSelected ? COLORS.primary : COLORS.textSecondary)}
                    </View>
                    <Text style={[styles.gameOptionText, isSelected && styles.gameOptionTextSelected]}>
                      {g === 'All' ? 'All Games' : g}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    paddingHorizontal: 16,
  },
  header: {
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gameFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameFilterButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameFilterButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterRowSecondary: {
    marginBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterPillSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterPillActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  swipeHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  emptyFilterContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  listContent: {
    gap: 12,
  },
  loadMoreButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sessionMeta: {
    flex: 1,
  },
  gameType: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sessionDateTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  netContainer: {
    alignItems: 'flex-end',
  },
  netProfitText: {
    fontSize: 16,
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
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 2,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  expandedSection: {
    marginTop: 12,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginBottom: 10,
  },
  expandedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  handRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  handDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  handNet: {
    fontSize: 12,
    fontWeight: '700',
  },
  splitRowBox: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitRowLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
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
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  buyInValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  buyInTotalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  buyInTotalLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  buyInTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  gameOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameOptionRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  gameOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gameOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  gameOptionTextSelected: {
    color: COLORS.primary,
  },
});
