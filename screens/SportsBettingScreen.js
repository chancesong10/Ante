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
import { moderateScale } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import SwipeableRow from '../components/SwipeableRow';

const COMMON_ODDS = ['-200', '-150', '-110', '+100', '+150', '+200'];
const BET_TYPES = ['Moneyline', 'Spread', 'Total'];

const calcPayout = (stake, americanOdds) => {
  const odds = parseFloat(americanOdds);
  if (isNaN(odds) || odds === 0) return 0;
  if (odds > 0) {
    return stake * (odds / 100);
  }
  return stake * (100 / Math.abs(odds));
};

export default function SportsBettingScreen({ navigation }) {
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
      startSession('Sports Betting');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [matchup, setMatchup] = useState('');
  const [betType, setBetType] = useState('Moneyline');
  const [stake, setStake] = useState('');
  const [odds, setOdds] = useState('');
  const [outcome, setOutcome] = useState(null);

  const resetForm = () => {
    setMatchup('');
    setBetType('Moneyline');
    setStake('');
    setOdds('');
    setOutcome(null);
  };

  const parsedStake = parseFloat(stake);
  const parsedOdds = parseFloat(odds);
  const hasValidStake = stake !== '' && !isNaN(parsedStake) && parsedStake > 0;
  const hasValidOdds = odds !== '' && !isNaN(parsedOdds) && parsedOdds !== 0;

  const projectedPayout = hasValidStake && hasValidOdds ? calcPayout(parsedStake, odds) : 0;

  const submitBet = () => {
    if (!hasValidStake || !hasValidOdds || !outcome) return;

    let netChange = 0;
    if (outcome === 'win') {
      netChange = calcPayout(parsedStake, odds);
    } else if (outcome === 'loss') {
      netChange = -parsedStake;
    } else {
      netChange = 0; // push
    }

    const record = {
      id: Date.now(),
      type: 'single',
      matchup: matchup.trim() || 'Untitled Bet',
      betType,
      bet: parsedStake,
      odds: parsedOdds,
      outcome,
      netChange,
    };

    logHandToActiveSession(record);
    resetForm();
  };

  const sessionBets = activeSession?.hands || [];
  const totalNet = sessionBets.reduce((sum, b) => sum + (b.netChange || 0), 0);
  const wins = sessionBets.filter((b) => b.outcome === 'win').length;
  const losses = sessionBets.filter((b) => b.outcome === 'loss').length;
  const pushes = sessionBets.filter((b) => b.outcome === 'push').length;

  const handleEndSessionPress = () => {
    if (sessionBets.length === 0) {
      discardActiveSession();
      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }
    endActiveSession();
    navigation.navigate('MainTabs', { screen: 'History' });
  };

  const canSubmit = hasValidStake && hasValidOdds && outcome;

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
          <Text style={styles.navTitle}>Sports Betting</Text>
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
              <Text style={styles.statPillLabel}>Bets</Text>
              <Text style={styles.statPillValue}>{sessionBets.length}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.label}>Matchup (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lakers vs Celtics"
            placeholderTextColor={COLORS.textMuted}
            value={matchup}
            onChangeText={setMatchup}
          />

          <Text style={styles.label}>Bet Type</Text>
          <View style={styles.betTypeRow}>
            {BET_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.betTypeChip, betType === type && styles.betTypeChipActive]}
                onPress={() => setBetType(type)}
              >
                <Text
                  style={[
                    styles.betTypeChipText,
                    betType === type && styles.betTypeChipTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Stake ($)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 50"
            placeholderTextColor={COLORS.textMuted}
            value={stake}
            onChangeText={setStake}
          />

          <Text style={styles.label}>Odds (American)</Text>
          <View style={styles.oddsRow}>
            {COMMON_ODDS.map((o) => (
              <TouchableOpacity
                key={o}
                style={[styles.oddsChip, odds === o && styles.oddsChipActive]}
                onPress={() => setOdds(o)}
              >
                <Text
                  style={[styles.oddsChipText, odds === o && styles.oddsChipTextActive]}
                >
                  {o}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            placeholder="Or type odds manually, e.g. -120"
            placeholderTextColor={COLORS.textMuted}
            value={odds}
            onChangeText={setOdds}
          />

          {hasValidStake && hasValidOdds && (
            <View style={styles.payoutPreview}>
              <Text style={styles.payoutPreviewLabel}>PROJECTED PROFIT IF WIN</Text>
              <Text style={styles.payoutPreviewValue}>
                +${projectedPayout.toFixed(2)}
              </Text>
            </View>
          )}

          <Text style={styles.label}>Outcome</Text>
          <View style={styles.outcomeRow}>
            <TouchableOpacity
              style={[styles.outcomeButton, outcome === 'win' && styles.winActive]}
              activeOpacity={0.7}
              onPress={() => setOutcome('win')}
            >
              <Text style={[styles.outcomeText, outcome === 'win' && styles.outcomeTextActive]}>
                Win
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outcomeButton, outcome === 'loss' && styles.lossActive]}
              activeOpacity={0.7}
              onPress={() => setOutcome('loss')}
            >
              <Text style={[styles.outcomeText, outcome === 'loss' && styles.outcomeTextActive]}>
                Loss
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outcomeButton, outcome === 'push' && styles.pushActive]}
              activeOpacity={0.7}
              onPress={() => setOutcome('push')}
            >
              <Text style={[styles.outcomeText, outcome === 'push' && styles.outcomeTextActive]}>
                Push
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
            onPress={submitBet}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>Log Bet</Text>
          </TouchableOpacity>
        </View>

        {sessionBets.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Bets in Current Session</Text>
            <Text style={styles.swipeHint}>Swipe a bet right to delete it</Text>

            {sessionBets.map((b) => (
              <SwipeableRow
                key={b.id}
                onDelete={() => removeHandFromActiveSession(b.id)}
                confirmTitle="Delete this bet?"
                confirmMessage="This cannot be undone."
              >
                <View style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyText}>
                      {b.matchup} — {b.betType}
                    </Text>
                    <Text style={styles.historySubtext}>
                      ${b.bet} @ {b.odds > 0 ? '+' : ''}{b.odds} — {b.outcome.toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.historyNet,
                      {
                        color:
                          b.netChange > 0
                            ? COLORS.success
                            : b.netChange < 0
                            ? COLORS.danger
                            : COLORS.textPrimary,
                      },
                    ]}
                  >
                    {b.netChange > 0 ? '+' : ''}${b.netChange.toFixed(2)}
                  </Text>
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
  navTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveIndicatorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
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
  headerEndButtonText: { color: COLORS.danger, fontSize: 12, fontWeight: '700' },
  scroll: { padding: 16 },
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
  netAmount: { fontSize: 34, fontWeight: '900', marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 8, width: '100%' },
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
  statPillValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
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
    fontSize: 16,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontWeight: '600',
    marginBottom: 8,
  },
  betTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  betTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  betTypeChipActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  betTypeChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  betTypeChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  oddsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  oddsChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  oddsChipActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  oddsChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  oddsChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  payoutPreview: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  payoutPreviewLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  payoutPreviewValue: { fontSize: 20, fontWeight: '900', color: COLORS.success, marginTop: 2 },
  outcomeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  outcomeButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  winActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  lossActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  pushActive: { backgroundColor: '#3F3F46', borderColor: '#52525B' },
  outcomeText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 14 },
  outcomeTextActive: { color: COLORS.textDark },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  submitDisabled: { backgroundColor: COLORS.cardBorder, opacity: 0.5 },
  submitText: { color: COLORS.textDark, fontWeight: '800', fontSize: 15 },
  historySection: { marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  swipeHint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 12 },
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
  historyText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  historySubtext: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  historyNet: { fontWeight: '700', fontSize: 14 },
});