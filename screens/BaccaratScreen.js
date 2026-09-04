import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useGameSession } from '../context/SessionContext';
import { useSessionEndFx } from '../context/SessionEndFxContext';
import { usePreferences, DEFAULT_QUICK_CHIP_PRESETS } from '../context/PreferencesContext';
import SwipeableRow from '../components/SwipeableRow';
import { useAuth } from '../context/AuthContext';
import GuestModeBanner from '../components/GuestModeBanner';
import LivePulseDot from '../components/LivePulseDot';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { calcBaccaratNet, BACCARAT_TIE_ODDS as TIE_ODDS } from '../utils/tableGameOdds';

const BET_ON = ['Player', 'Banker', 'Tie'];

export default function BaccaratScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currencySymbol = '$', quickChipsEnabled, quickChipPresets } = usePreferences();
  const chipPreset =
    Array.isArray(quickChipPresets?.baccarat) && quickChipPresets.baccarat.length > 0
      ? quickChipPresets.baccarat
      : DEFAULT_QUICK_CHIP_PRESETS.baccarat;
  const { user } = useAuth();

  const {
    activeSession,
    startSession,
    logHandToActiveSession,
    removeHandFromActiveSession,
    endActiveSession,
    discardActiveSession,
  } = useGameSession('Baccarat');
  const { endSessionWithFx } = useSessionEndFx();

  useEffect(() => {
    if (!activeSession || activeSession.gameType !== 'Baccarat') {
      startSession('Baccarat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [betOn, setBetOn] = useState('Player');
  const [bet, setBet] = useState('');

  const parsedBet = parseFloat(bet);
  const hasValidBet = bet !== '' && !isNaN(parsedBet) && parsedBet > 0;
  const canPush = betOn !== 'Tie';
  const projectedWin = hasValidBet ? calcBaccaratNet(betOn, parsedBet, 'win') : 0;

  const handleChipPress = (chipValue) => {
    hapticLight();
    const current = parseFloat(bet) || 0;
    setBet(String(current + parseFloat(chipValue)));
  };

  const submitHand = (outcome) => {
    if (!hasValidBet) return;
    outcome === 'win' ? hapticSuccess() : hapticLight();

    const record = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      type: 'single',
      betOn,
      bet: parsedBet,
      outcome,
      netChange: calcBaccaratNet(betOn, parsedBet, outcome),
      createdAt: Date.now(),
    };

    logHandToActiveSession(record);
    setBet('');
  };

  const hands = activeSession?.hands || [];
  const totalNet = hands.reduce((sum, h) => sum + (h.netChange || 0), 0);
  const wins = hands.filter((h) => h.outcome === 'win').length;
  const losses = hands.filter((h) => h.outcome === 'loss').length;
  const pushes = hands.filter((h) => h.outcome === 'push').length;

  const handleEndSessionPress = () => {
    hapticSuccess();
    if (hands.length === 0) {
      discardActiveSession();
      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }
    endSessionWithFx({
      net: totalNet,
      gameType: 'Baccarat',
      onCommit: () => endActiveSession(),
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topNav, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <LivePulseDot size={8} color={COLORS.danger} />
          <Text style={[styles.navTitle, { marginLeft: 8 }]}>Baccarat Tracker</Text>
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
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + moderateScale(96) }]}
        showsVerticalScrollIndicator={false}
      >
        {!user && <GuestModeBanner />}

        {/* SESSION STATS */}
        <View style={[styles.statsBox, SHADOWS.card]}>
          <Text style={styles.statsSubtext}>SESSION NET OUTCOME</Text>
          <Text
            style={[
              styles.netAmount,
              { color: totalNet > 0 ? COLORS.success : totalNet < 0 ? COLORS.danger : COLORS.textPrimary },
            ]}
          >
            {totalNet > 0 ? '+' : totalNet < 0 ? '-' : ''}
            {currencySymbol}
            {Math.abs(totalNet).toFixed(2)}
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
              <Text style={styles.statPillValue}>{hands.length}</Text>
            </View>
          </View>
        </View>

        {/* BET ON SELECTOR */}
        <View style={styles.betOnWrapper}>
          {BET_ON.map((b) => {
            const active = betOn === b;
            return (
              <TouchableOpacity
                key={b}
                style={[styles.betOnTab, active && styles.betOnTabActive]}
                onPress={() => {
                  setBetOn(b);
                  hapticLight();
                }}
              >
                <Text style={[styles.betOnText, active && styles.betOnTextActive]}>{b}</Text>
                <Text style={[styles.betOnOdds, active && styles.betOnOddsActive]}>
                  {b === 'Player' ? '1:1' : b === 'Banker' ? '0.95:1' : `${TIE_ODDS}:1`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {betOn === 'Banker' && (
          <Text style={styles.commissionNote}>5% commission on Banker wins is applied automatically.</Text>
        )}

        {/* BET AMOUNT */}
        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash-outline" size={16} color={COLORS.success} style={{ marginRight: 6 }} />
            <Text style={styles.cardTitle}>Bet Amount</Text>
          </View>

          <Text style={styles.label}>Amount ({currencySymbol})</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 25"
            placeholderTextColor={COLORS.textMuted}
            value={bet}
            onChangeText={setBet}
          />

          {quickChipsEnabled && (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.quickActionLabel}>+ Chip</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipWrapRowHorizontal}>
                  {chipPreset.map((chip) => (
                    <TouchableOpacity key={chip} style={styles.stakeChip} onPress={() => handleChipPress(chip)}>
                      <Text style={styles.stakeChipText}>
                        {currencySymbol}
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {hasValidBet && (
            <View style={styles.payoutPreview}>
              <Text style={styles.payoutPreviewLabel}>TO WIN</Text>
              <Text style={styles.payoutPreviewValue}>
                +{currencySymbol}
                {projectedWin.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.outcomeActionRow}>
            <TouchableOpacity
              style={[styles.outcomeButton, !hasValidBet && styles.outcomeButtonDisabled, { backgroundColor: COLORS.success }]}
              onPress={() => submitHand('win')}
              disabled={!hasValidBet}
              activeOpacity={0.85}
            >
              <Text style={styles.outcomeButtonText}>Win</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outcomeButton, !hasValidBet && styles.outcomeButtonDisabled, { backgroundColor: COLORS.danger }]}
              onPress={() => submitHand('loss')}
              disabled={!hasValidBet}
              activeOpacity={0.85}
            >
              <Text style={styles.outcomeButtonText}>Loss</Text>
            </TouchableOpacity>
            {canPush && (
              <TouchableOpacity
                style={[styles.outcomeButton, !hasValidBet && styles.outcomeButtonDisabled, { backgroundColor: COLORS.neutral }]}
                onPress={() => submitHand('push')}
                disabled={!hasValidBet}
                activeOpacity={0.85}
              >
                <Text style={styles.outcomeButtonText}>Push</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* HAND HISTORY */}
        {hands.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.cardTitle}>Session Hands ({hands.length})</Text>
            </View>
            <Text style={styles.swipeHint}>Swipe a hand to delete</Text>

            {hands.map((h) => (
              <SwipeableRow
                key={h.id}
                onDelete={() => removeHandFromActiveSession(h.id)}
                confirmTitle="Delete this hand?"
                confirmMessage="This cannot be undone."
              >
                <View style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.betTypeBadge}>
                      <Text style={styles.betTypeBadgeText}>{h.betOn}</Text>
                    </View>
                    <Text style={styles.historySubtext}>
                      {currencySymbol}
                      {h.bet}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.historyNet,
                      { color: h.netChange > 0 ? COLORS.success : h.netChange < 0 ? COLORS.danger : COLORS.textPrimary },
                    ]}
                  >
                    {h.netChange > 0 ? '+' : h.netChange < 0 ? '-' : ''}
                    {currencySymbol}
                    {Math.abs(h.netChange).toFixed(2)}
                  </Text>
                </View>
              </SwipeableRow>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  navTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  headerEndButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  headerEndButtonText: { color: COLORS.danger, fontSize: 11, fontWeight: '700' },
  scroll: { padding: 16 },
  statsBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statsSubtext: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  netAmount: { fontSize: 32, fontWeight: '700', marginBottom: 12 },
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
  statPillLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', fontWeight: '600' },
  statPillValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  betOnWrapper: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  betOnTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  betOnTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  betOnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  betOnTextActive: { color: COLORS.textDark },
  betOnOdds: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  betOnOddsActive: { color: COLORS.textDark, opacity: 0.7 },
  commissionNote: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontWeight: '600',
    marginBottom: 14,
  },
  quickActionLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  chipWrapRowHorizontal: { flexDirection: 'row', gap: 8 },
  stakeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stakeChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  payoutPreview: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  payoutPreviewLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  payoutPreviewValue: { fontSize: 24, fontWeight: '700', color: COLORS.success },
  outcomeActionRow: { flexDirection: 'row', gap: 10 },
  outcomeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  outcomeButtonDisabled: { opacity: 0.4 },
  outcomeButtonText: { color: COLORS.textDark, fontWeight: '700', fontSize: 15 },
  historySection: { marginTop: 8 },
  swipeHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12, textAlign: 'center' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  betTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 4,
  },
  betTypeBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  historySubtext: { color: COLORS.textSecondary, fontSize: 12 },
  historyNet: { fontSize: 14, fontWeight: '700' },
});
