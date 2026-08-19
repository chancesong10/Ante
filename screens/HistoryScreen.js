import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import { usePreferences } from '../context/PreferencesContext';
import SwipeableRow from '../components/SwipeableRow';

const renderGameIcon = (gameType, size = 18, color = COLORS.primary) => {
  if (gameType === 'Poker') return <Ionicons name="cash-outline" size={size} color={color} />;
  if (gameType === 'Sports Betting') return <Ionicons name="basketball-outline" size={size} color={color} />;
  if (gameType === 'General') return <Ionicons name="dice-outline" size={size} color={color} />;
  return <MaterialCommunityIcons name="cards" size={size} color={color} />;
};

export default function HistoryScreen({ navigation }) {
  const { sessionHistory, deleteSession } = useSession();
  const { currencySymbol = '$', privacyMode = false } = usePreferences();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const filteredHistory = sessionHistory.filter((item) => {
    if (filter === 'Wins') return item.netProfit > 0;
    if (filter === 'Losses') return item.netProfit < 0;
    return true;
  });

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
            <View style={styles.iconCircle}>
              {renderGameIcon(item.gameType, 18, COLORS.primary)}
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
            <View style={styles.filterRow}>
              {['All', 'Wins', 'Losses'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, filter === f && styles.filterPillActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      filter === f && styles.filterPillTextActive,
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
            data={filteredHistory}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderSessionItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + moderateScale(96) },
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
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
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
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
  listContent: {
    gap: 12,
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
    fontWeight: '900',
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
    fontWeight: '800',
  },
  buyInTotalValue: {
    fontSize: 16,
    fontWeight: '900',
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
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});