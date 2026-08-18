import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useSession } from '../context/SessionContext';

export default function HistoryScreen({ navigation }) {
  const { sessionHistory, deleteSession } = useSession();
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

    return (
      <View style={[styles.card, SHADOWS.card]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => toggleExpand(item.id)}
          style={styles.cardHeader}
        >
          <View style={styles.iconCircle}>
            <Ionicons
              name="game-controller"
              size={moderateScale(18)}
              color={COLORS.primary}
            />
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
                    ? COLORS.primary
                    : isLoss
                    ? COLORS.danger
                    : COLORS.textPrimary,
                },
              ]}
            >
              {isWin ? '+' : ''}${item.netProfit.toFixed(2)}
            </Text>
            <View style={styles.durationRow}>
              <Ionicons
                name="time-outline"
                size={moderateScale(12)}
                color={COLORS.textMuted}
              />
              <Text style={styles.durationText}>{item.durationFormatted}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Stats Strip */}
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
            <Text style={[styles.statVal, isWin && { color: COLORS.primary }]}>
              {item.winRate.toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* Expanded Hand Breakdown */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            <View style={styles.expandedDivider} />
            <Text style={styles.expandedTitle}>Logged Hands ({item.hands.length})</Text>
            {item.hands.map((h, idx) => {
              if (h.type === 'split') {
                return (
                  <View key={idx} style={styles.splitRowBox}>
                    <Text style={styles.splitRowLabel}>Split Pair</Text>
                    {h.hands.map((subHand, sIdx) => (
                      <View key={sIdx} style={styles.handRow}>
                        <Text style={styles.handDetail}>
                          Hand {sIdx + 1}: ${subHand.bet}
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
                                  ? COLORS.primary
                                  : subHand.netChange < 0
                                  ? COLORS.danger
                                  : COLORS.textPrimary,
                            },
                          ]}
                        >
                          {subHand.netChange > 0 ? '+' : ''}$
                          {subHand.netChange.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }

              return (
                <View key={idx} style={styles.handRow}>
                  <Text style={styles.handDetail}>
                    Hand {idx + 1}: ${h.bet}
                    {h.doubled ? ' (2x)' : ''}
                    {h.blackjack ? ' (BJ)' : ''} — {h.outcome.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.handNet,
                      {
                        color:
                          h.netChange > 0
                            ? COLORS.primary
                            : h.netChange < 0
                            ? COLORS.danger
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {h.netChange > 0 ? '+' : ''}${h.netChange.toFixed(2)}
                  </Text>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.deleteBtn}
              hitSlop={TOUCH_TARGET.hitSlop}
              onPress={() => deleteSession(item.id)}
            >
              <Ionicons
                name="trash-outline"
                size={moderateScale(14)}
                color={COLORS.danger}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.deleteBtnText}>Delete Log Entry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>Recorded live game sessions</Text>
          </View>
        </View>

        {/* Filter Pills */}
        {sessionHistory.length > 0 && (
          <View style={styles.filterRow}>
            {['All', 'Wins', 'Losses'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, filter === f && styles.filterPillActive]}
                onPress={() => setFilter(f)}
                hitSlop={TOUCH_TARGET.hitSlop}
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
        )}

        {/* Session List */}
        {sessionHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name="time-outline"
                size={moderateScale(36)}
                color={COLORS.textMuted}
              />
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
              {
                paddingBottom: insets.bottom + moderateScale(96),
              },
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
    paddingHorizontal: SPACING.pageHorizontal,
  },
  header: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: fluidFont(26),
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  filterPill: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(7),
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterPillActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: fluidFont(12),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  listContent: {
    gap: SPACING.sm,
  },
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
  iconCircle: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.2)',
  },
  sessionMeta: {
    flex: 1,
  },
  gameType: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sessionDateTime: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  netContainer: {
    alignItems: 'flex-end',
  },
  netProfitText: {
    fontSize: fluidFont(16),
    fontWeight: '900',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  durationText: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.xs,
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    marginTop: SPACING.sm,
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
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statVal: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: moderateScale(8),
  },
  handRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(5),
  },
  handDetail: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
  },
  handNet: {
    fontSize: fluidFont(12),
    fontWeight: '700',
  },
  splitRowBox: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.xs,
    padding: moderateScale(8),
    marginVertical: moderateScale(4),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitRowLabel: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    paddingVertical: moderateScale(6),
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: fluidFont(11),
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: moderateScale(50),
  },
  emptyIconCircle: {
    width: moderateScale(68),
    height: moderateScale(68),
    borderRadius: moderateScale(34),
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  emptyTitle: {
    fontSize: fluidFont(18),
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: fluidFont(18),
  },
});