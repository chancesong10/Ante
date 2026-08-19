import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import SwipeableRow from '../components/SwipeableRow';
import { usePreferences } from '../context/PreferencesContext';

const emptyHand = () => ({ betAmount: '', doubled: false, blackjack: false, outcome: null });

export default function BlackjackScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    activeSession,
    startSession,
    logHandToActiveSession,
    removeHandFromActiveSession,
    endActiveSession,
    discardActiveSession,
  } = useSession();

  useEffect(() => {
    if (!activeSession) {
      startSession('Blackjack');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [betAmount, setBetAmount] = useState('');
  const [doubled, setDoubled] = useState(false);
  const [blackjack, setBlackjack] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [split, setSplit] = useState(false);

  const [splitHand1, setSplitHand1] = useState(emptyHand());
  const [splitHand2, setSplitHand2] = useState(emptyHand());

  const { quickChipsEnabled } = usePreferences();

  const resetForm = () => {
    setBetAmount('');
    setDoubled(false);
    setBlackjack(false);
    setOutcome(null);
    setSplit(false);
    setSplitHand1(emptyHand());
    setSplitHand2(emptyHand());
  };

  const canToggleSplit = betAmount && parseFloat(betAmount) > 0;

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
    return 0;
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
      >
        <Text style={[styles.outcomeText, currentOutcome === 'win' && styles.outcomeTextActive]}>
          Win
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'loss' && styles.lossActive]}
        activeOpacity={0.7}
        onPress={() => onSelect('loss')}
      >
        <Text style={[styles.outcomeText, currentOutcome === 'loss' && styles.lossTextLossActive]}>
          Loss
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.outcomeButton, currentOutcome === 'push' && styles.pushActive]}
        activeOpacity={0.7}
        onPress={() => onSelect('push')}
      >
        <Text style={[styles.outcomeText, currentOutcome === 'push' && styles.outcomeTextActive]}>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <View style={styles.liveIndicatorDot} />
          <Text style={styles.navTitle}>Live Blackjack</Text>
        </View>

        <TouchableOpacity
          style={styles.headerEndButton}
          activeOpacity={0.8}
          onPress={handleEndSessionPress}
        >
          <Ionicons name="stop-circle" size={16} color={COLORS.danger} style={{ marginRight: 4 }} />
          <Text style={styles.headerEndButtonText}>End Session</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + moderateScale(96) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statsBox, SHADOWS.card]}>
          <Text style={styles.statsSubtext}>SESSION NET OUTCOME</Text>
          <Text
            style={[
              styles.netAmount,
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
            {totalNet > 0 ? '+' : ''}${totalNet.toFixed(2)}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Wins</Text>
              <Text style={[styles.statPillValue, { color: COLORS.success }]}>{wins}</Text>
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

        <View style={[styles.card, SHADOWS.card]}>
          <TouchableOpacity
            style={[
              styles.splitToggleButton,
              split && styles.splitToggleActive,
              !split && !canToggleSplit && styles.splitToggleDisabled,
            ]}
            activeOpacity={0.8}
            onPress={toggleSplit}
            disabled={!split && !canToggleSplit}
          >
            <Ionicons
              name={split ? 'close-circle' : 'git-branch-outline'}
              size={18}
              color={
                split ? COLORS.danger : !canToggleSplit ? COLORS.textMuted : COLORS.primary
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.splitToggleText,
                split && { color: COLORS.danger },
                !split && !canToggleSplit && { color: COLORS.textMuted },
              ]}
            >
              {split ? 'Cancel Split Hand' : 'Split Hand Mode'}
            </Text>
          </TouchableOpacity>

          {!split ? (
            <>
              <Text style={styles.label}>Bet Amount ($)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 25"
                placeholderTextColor={COLORS.textMuted}
                value={betAmount}
                onChangeText={setBetAmount}
              />

              {quickChipsEnabled && (
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
              )}

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

              <Text style={styles.label}>Hand Outcome</Text>
              {renderOutcomeRow(outcome, setOutcome)}
            </>
          ) : (
            <>
              {renderSplitHandForm(1)}
              {renderSplitHandForm(2)}
            </>
          )}

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

        {sessionHands.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Hands in Current Session</Text>
            <Text style={styles.swipeHint}>Swipe a hand left to delete it</Text>

            {sessionHands.map((r) => {
              if (r.type === 'split') {
                const groupNet = r.hands[0].netChange + r.hands[1].netChange;
                return (
                  <SwipeableRow
                    key={r.id}
                    onDelete={() => removeHandFromActiveSession(r.id)}
                    confirmTitle="Delete this split pair?"
                    confirmMessage="Both hands in this split will be removed. This cannot be undone."
                  >
                    <View style={styles.splitGroupBox}>
                      <Text style={styles.splitGroupLabel}>SPLIT HANDS</Text>
                      {r.hands.map((h, i) => (
                        <View key={i} style={styles.historyRow}>
                          <Text style={styles.historyText}>
                            Hand {i + 1}: ${h.bet}{h.doubled ? ' (2x)' : ''}{h.blackjack ? ' (BJ)' : ''} — {h.outcome.toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              styles.historyNet,
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
                                  ? COLORS.success
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
                  </SwipeableRow>
                );
              }

              return (
                <SwipeableRow
                  key={r.id}
                  onDelete={() => removeHandFromActiveSession(r.id)}
                  confirmTitle="Delete this hand?"
                  confirmMessage="This cannot be undone."
                >
                  <View style={styles.historyRow}>
                    <Text style={styles.historyText}>
                      ${r.bet}{r.doubled ? ' (2x)' : ''}{r.blackjack ? ' (BJ)' : ''} — {r.outcome.toUpperCase()}
                    </Text>
                    <Text
                      style={[
                        styles.historyNet,
                        {
                          color:
                            r.netChange > 0
                              ? COLORS.success
                              : r.netChange < 0
                              ? COLORS.danger
                              : COLORS.textPrimary,
                        },
                      ]}
                    >
                      {r.netChange > 0 ? '+' : ''}${r.netChange.toFixed(2)}
                    </Text>
                  </View>
                </SwipeableRow>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerEndButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
  },
  headerEndButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    padding: 16,
  },
  statsBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statsSubtext: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  netAmount: {
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statPillLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statPillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  splitToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitToggleActive: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerMuted,
  },
  splitToggleDisabled: {
    opacity: 0.4,
  },
  splitToggleText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    color: COLORS.textPrimary,
    fontSize: 18,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  chipButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  toggleActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  toggleTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  outcomeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  outcomeButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  winActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
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
    fontSize: 14,
  },
  outcomeTextActive: {
    color: COLORS.textDark,
  },
  lossTextLossActive: {
    color: COLORS.textPrimary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitDisabled: {
    backgroundColor: COLORS.cardBorder,
    opacity: 0.5,
  },
  submitText: {
    color: COLORS.textDark,
    fontWeight: '800',
    fontSize: 15,
  },
  splitHandBox: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitHandTitle: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  historySection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  swipeHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  splitGroupBox: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitGroupLabel: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 6,
    letterSpacing: 1,
  },
  splitGroupTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  splitGroupTotalLabel: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  historyText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  historyNet: {
    fontWeight: '700',
    fontSize: 14,
  },
});