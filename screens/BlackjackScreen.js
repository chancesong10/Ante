import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useSession } from '../context/SessionContext';

const emptyHand = () => ({ betAmount: '', doubled: false, blackjack: false, outcome: null });

export default function BlackjackScreen({ navigation }) {
  const {
    activeSession,
    startSession,
    logHandToActiveSession,
    endActiveSession,
    discardActiveSession,
  } = useSession();

  const insets = useSafeAreaInsets();

  // Ensure an active session exists when mounting
  useEffect(() => {
    if (!activeSession) {
      startSession('Blackjack');
    }
  }, []);

  const [betAmount, setBetAmount] = useState('');
  const [doubled, setDoubled] = useState(false);
  const [blackjack, setBlackjack] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [split, setSplit] = useState(false);

  const [splitHand1, setSplitHand1] = useState(emptyHand());
  const [splitHand2, setSplitHand2] = useState(emptyHand());

  const resetForm = () => {
    setBetAmount('');
    setDoubled(false);
    setBlackjack(false);
    setOutcome(null);
    setSplit(false);
    setSplitHand1(emptyHand());
    setSplitHand2(emptyHand());
  };

  const toggleSplit = () => {
    if (!split) {
      setSplitHand1({ ...emptyHand(), betAmount });
      setSplitHand2({ ...emptyHand(), betAmount });
    }
    setSplit(!split);
  };

  const calcNet = (bet, doubledFlag, blackjackFlag, outcomeVal) => {
    let stake = doubledFlag ? bet * 2 : bet;
    if (outcomeVal === 'win') return blackjackFlag ? stake * 1.5 : stake;
    if (outcomeVal === 'loss') return -stake;
    return 0; // push
  };

  const submitHand = () => {
    if (split) {
      const bet1 = parseFloat(splitHand1.betAmount);
      const bet2 = parseFloat(splitHand2.betAmount);
      if (isNaN(bet1) || bet1 <= 0 || !splitHand1.outcome) return;
      if (isNaN(bet2) || bet2 <= 0 || !splitHand2.outcome) return;

      const hand1 = {
        bet: bet1,
        doubled: splitHand1.doubled,
        blackjack: splitHand1.blackjack,
        outcome: splitHand1.outcome,
        netChange: calcNet(bet1, splitHand1.doubled, splitHand1.blackjack, splitHand1.outcome),
      };
      const hand2 = {
        bet: bet2,
        doubled: splitHand2.doubled,
        blackjack: splitHand2.blackjack,
        outcome: splitHand2.outcome,
        netChange: calcNet(bet2, splitHand2.doubled, splitHand2.blackjack, splitHand2.outcome),
      };

      const record = {
        id: Date.now(),
        type: 'split',
        hands: [hand1, hand2],
      };

      logHandToActiveSession(record);
      resetForm();
      return;
    }

    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0 || !outcome) return;

    const record = {
      id: Date.now(),
      type: 'single',
      bet,
      doubled,
      blackjack,
      outcome,
      netChange: calcNet(bet, doubled, blackjack, outcome),
    };

    logHandToActiveSession(record);
    resetForm();
  };

  // Live session statistics from activeSession.hands
  const sessionHands = activeSession?.hands || [];
  const allHands = sessionHands.flatMap((r) => (r.type === 'split' ? r.hands : [r]));
  const totalNet = allHands.reduce((sum, h) => sum + (h.netChange || 0), 0);
  const wins = allHands.filter((h) => h.outcome === 'win').length;
  const losses = allHands.filter((h) => h.outcome === 'loss').length;
  const pushes = allHands.filter((h) => h.outcome === 'push').length;

  const handleEndSessionPress = () => {
    if (allHands.length === 0) {
      discardActiveSession();
      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }

    endActiveSession();
    navigation.navigate('MainTabs', { screen: 'History' });
  };

  const updateSplitHand = (which, field, value) => {
    const setter = which === 1 ? setSplitHand1 : setSplitHand2;
    const current = which === 1 ? splitHand1 : splitHand2;
    setter({ ...current, [field]: value });
  };

  const renderOutcomeRow = (currentOutcome, onSelect) => (
    <View style={styles.outcomeRow}>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'win' && styles.winActive]}
        activeOpacity={0.7}
        onPress={() => onSelect('win')}
        accessibilityRole="button"
        accessibilityLabel="Win outcome"
      >
        <Text
          style={[
            styles.outcomeText,
            currentOutcome === 'win' && styles.outcomeTextActive,
          ]}
        >
          Win
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'loss' && styles.lossActive]}
        activeOpacity={0.7}
        onPress={() => onSelect('loss')}
        accessibilityRole="button"
        accessibilityLabel="Loss outcome"
      >
        <Text
          style={[
            styles.outcomeText,
            currentOutcome === 'loss' && styles.lossTextLossActive,
          ]}
        >
          Loss
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'push' && styles.pushActive]}
        activeOpacity={0.7}
        onPress={() => onSelect('push')}
        accessibilityRole="button"
        accessibilityLabel="Push outcome"
      >
        <Text
          style={[
            styles.outcomeText,
            currentOutcome === 'push' && styles.outcomeTextActive,
          ]}
        >
          Push
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSplitHandForm = (which) => {
    const hand = which === 1 ? splitHand1 : splitHand2;
    return (
      <View style={styles.splitHandBox}>
        <Text style={styles.splitHandTitle}>Split Hand {which}</Text>

        <Text style={styles.label}>Bet Amount ($)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 25"
          placeholderTextColor={COLORS.textMuted}
          value={hand.betAmount}
          onChangeText={(v) => updateSplitHand(which, 'betAmount', v)}
        />

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, hand.doubled && styles.toggleActive]}
            activeOpacity={0.7}
            onPress={() => updateSplitHand(which, 'doubled', !hand.doubled)}
          >
            <Text style={[styles.toggleText, hand.doubled && styles.toggleTextActive]}>
              2x Doubled
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, hand.blackjack && styles.toggleActive]}
            activeOpacity={0.7}
            onPress={() => updateSplitHand(which, 'blackjack', !hand.blackjack)}
          >
            <Text style={[styles.toggleText, hand.blackjack && styles.toggleTextActive]}>
              Blackjack 3:2
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Outcome</Text>
        {renderOutcomeRow(hand.outcome, (val) => updateSplitHand(which, 'outcome', val))}
      </View>
    );
  };

  const canSubmitSplit =
    splitHand1.betAmount && splitHand1.outcome && splitHand2.betAmount && splitHand2.outcome;
  const canSubmitSingle = betAmount && outcome;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Top Header Navigation Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={TOUCH_TARGET.hitSlop}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Ionicons
            name="chevron-back"
            size={moderateScale(22)}
            color={COLORS.textPrimary}
          />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <View style={styles.liveIndicatorDot} />
          <Text style={styles.navTitle}>Live Blackjack</Text>
        </View>

        {/* PROMINENT END SESSION BUTTON IN HEADER */}
        <TouchableOpacity
          style={styles.headerEndButton}
          activeOpacity={0.8}
          hitSlop={TOUCH_TARGET.hitSlop}
          onPress={handleEndSessionPress}
          accessibilityRole="button"
          accessibilityLabel="End Session"
        >
          <Ionicons
            name="stop-circle"
            size={moderateScale(16)}
            color={COLORS.danger}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.headerEndButtonText}>End</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: insets.bottom + moderateScale(40),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Live Net Scoreboard */}
        <View style={[styles.statsBox, SHADOWS.card]}>
          <Text style={styles.statsSubtext}>SESSION NET OUTCOME</Text>
          <Text
            style={[
              styles.netAmount,
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

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Wins</Text>
              <Text style={[styles.statPillValue, { color: COLORS.primary }]}>{wins}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Losses</Text>
              <Text style={[styles.statPillValue, { color: COLORS.danger }]}>{losses}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Pushes</Text>
              <Text style={styles.statPillValue}>{pushes}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Hands</Text>
              <Text style={styles.statPillValue}>{allHands.length}</Text>
            </View>
          </View>
        </View>

        {/* Hand Entry Form */}
        <View style={[styles.card, SHADOWS.card]}>
          {/* Split Mode Toggle */}
          <TouchableOpacity
            style={[styles.splitToggleButton, split && styles.splitToggleActive]}
            activeOpacity={0.8}
            onPress={toggleSplit}
          >
            <Ionicons
              name={split ? 'close-circle' : 'git-branch-outline'}
              size={moderateScale(18)}
              color={split ? COLORS.danger : COLORS.primary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.splitToggleText,
                split && { color: COLORS.danger },
              ]}
            >
              {split ? 'Cancel Split Hand' : 'Split Hand Mode'}
            </Text>
          </TouchableOpacity>

          {!split ? (
            <>
              {/* Single Hand Bet Amount */}
              <Text style={styles.label}>Bet Amount ($)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 25"
                placeholderTextColor={COLORS.textMuted}
                value={betAmount}
                onChangeText={setBetAmount}
              />

              {/* Quick Chip Selector */}
              <View style={styles.chipRow}>
                {['10', '25', '50', '100', '250'].map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.chipButton}
                    onPress={() => setBetAmount(chip)}
                  >
                    <Text style={styles.chipText}>${chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Doubled & Blackjack Toggles */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleButton, doubled && styles.toggleActive]}
                  activeOpacity={0.7}
                  onPress={() => setDoubled(!doubled)}
                >
                  <Text style={[styles.toggleText, doubled && styles.toggleTextActive]}>
                    2x Doubled
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleButton, blackjack && styles.toggleActive]}
                  activeOpacity={0.7}
                  onPress={() => setBlackjack(!blackjack)}
                >
                  <Text style={[styles.toggleText, blackjack && styles.toggleTextActive]}>
                    Blackjack 3:2
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Outcome Selection */}
              <Text style={styles.label}>Hand Outcome</Text>
              {renderOutcomeRow(outcome, setOutcome)}
            </>
          ) : (
            <>
              {renderSplitHandForm(1)}
              {renderSplitHandForm(2)}
            </>
          )}

          {/* Submit Hand Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !(split ? canSubmitSplit : canSubmitSingle) && styles.submitDisabled,
            ]}
            onPress={submitHand}
            disabled={!(split ? canSubmitSplit : canSubmitSingle)}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>
              {split ? 'Log Split Hands' : 'Log Hand Outcome'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* PROMINENT END SESSION FOOTER BUTTON */}
        <TouchableOpacity
          style={styles.bottomEndSessionButton}
          activeOpacity={0.85}
          onPress={handleEndSessionPress}
        >
          <Ionicons
            name="stop-circle-outline"
            size={moderateScale(20)}
            color={COLORS.danger}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.bottomEndSessionText}>End Session & Save to History</Text>
        </TouchableOpacity>

        {/* Live Session Hand Log */}
        {sessionHands.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Hands in Current Session</Text>
            {sessionHands.map((r) => {
              if (r.type === 'split') {
                const groupNet = r.hands[0].netChange + r.hands[1].netChange;
                return (
                  <View key={r.id} style={styles.splitGroupBox}>
                    <Text style={styles.splitGroupLabel}>SPLIT HANDS</Text>
                    {r.hands.map((h, i) => (
                      <View key={i} style={styles.historyRow}>
                        <Text style={styles.historyText}>
                          Hand {i + 1}: ${h.bet}
                          {h.doubled ? ' (2x)' : ''}
                          {h.blackjack ? ' (BJ)' : ''} — {h.outcome.toUpperCase()}
                        </Text>
                        <Text
                          style={[
                            styles.historyNet,
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
                    ))}
                    <View style={styles.splitGroupTotalRow}>
                      <Text style={styles.splitGroupTotalLabel}>Split Combined</Text>
                      <Text
                        style={[
                          styles.historyNet,
                          {
                            color:
                              groupNet > 0
                                ? COLORS.primary
                                : groupNet < 0
                                ? COLORS.danger
                                : COLORS.textPrimary,
                          },
                        ]}
                      >
                        {groupNet > 0 ? '+' : ''}${groupNet.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <View key={r.id} style={styles.historyRow}>
                  <Text style={styles.historyText}>
                    ${r.bet}
                    {r.doubled ? ' (2x)' : ''}
                    {r.blackjack ? ' (BJ)' : ''} — {r.outcome.toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.historyNet,
                      {
                        color:
                          r.netChange > 0
                            ? COLORS.primary
                            : r.netChange < 0
                            ? COLORS.danger
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {r.netChange > 0 ? '+' : ''}${r.netChange.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: moderateScale(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(19),
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  navTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicatorDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: COLORS.primary,
  },
  navTitle: {
    fontSize: fluidFont(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerEndButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
    minHeight: TOUCH_TARGET.minSize - 8,
  },
  headerEndButtonText: {
    color: COLORS.danger,
    fontSize: fluidFont(12),
    fontWeight: '700',
  },
  scroll: {
    padding: SPACING.pageHorizontal,
  },
  statsBox: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statsSubtext: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(11),
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  netAmount: {
    fontSize: fluidFont(34),
    fontWeight: '900',
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    width: '100%',
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    paddingVertical: moderateScale(8),
    alignItems: 'center',
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statPillLabel: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statPillValue: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  splitToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.sm,
    padding: moderateScale(12),
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: TOUCH_TARGET.minSize,
  },
  splitToggleActive: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerMuted,
  },
  splitToggleText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: fluidFont(13),
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(12),
    fontWeight: '600',
    marginBottom: moderateScale(8),
    marginTop: moderateScale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    color: COLORS.textPrimary,
    fontSize: fluidFont(18),
    borderRadius: RADIUS.sm,
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontWeight: '700',
    minHeight: TOUCH_TARGET.minSize,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    marginBottom: moderateScale(6),
  },
  chipButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    paddingVertical: moderateScale(10),
    borderRadius: RADIUS.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: TOUCH_TARGET.minSize - 4,
    justifyContent: 'center',
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(12),
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: TOUCH_TARGET.minSize,
  },
  toggleActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: fluidFont(13),
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  outcomeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: 4,
  },
  outcomeButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: TOUCH_TARGET.minSize,
  },
  winActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  lossActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  pushActive: {
    backgroundColor: '#3F3F46',
    borderColor: '#52525B',
  },
  outcomeText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: fluidFont(14),
  },
  outcomeTextActive: {
    color: COLORS.textDark,
  },
  lossTextLossActive: {
    color: COLORS.textPrimary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(15),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    minHeight: TOUCH_TARGET.minSize,
  },
  submitDisabled: {
    backgroundColor: COLORS.cardBorder,
    opacity: 0.5,
  },
  submitText: {
    color: COLORS.textDark,
    fontWeight: '800',
    fontSize: fluidFont(15),
  },
  bottomEndSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(15),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 69, 58, 0.4)',
    marginBottom: SPACING.md,
    minHeight: TOUCH_TARGET.minSize,
  },
  bottomEndSessionText: {
    color: COLORS.danger,
    fontSize: fluidFont(14),
    fontWeight: '800',
  },
  splitHandBox: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.md,
    padding: moderateScale(14),
    marginTop: moderateScale(10),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitHandTitle: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: fluidFont(14),
    marginBottom: 4,
  },
  historySection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: fluidFont(16),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  splitGroupBox: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: moderateScale(12),
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitGroupLabel: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: fluidFont(11),
    marginBottom: 6,
    letterSpacing: 1,
  },
  splitGroupTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: moderateScale(8),
    marginTop: moderateScale(6),
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  splitGroupTotalLabel: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: fluidFont(13),
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    padding: moderateScale(12),
    marginBottom: moderateScale(8),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  historyText: {
    color: COLORS.textPrimary,
    fontSize: fluidFont(13),
    fontWeight: '500',
  },
  historyNet: {
    fontWeight: '700',
    fontSize: fluidFont(14),
  },
});