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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useActiveSession } from '../context/SessionContext';
import { usePreferences } from '../context/PreferencesContext';
import SwipeableRow from '../components/SwipeableRow';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import GuestModeBanner from '../components/GuestModeBanner';
import LivePulseDot from '../components/LivePulseDot';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const COMMON_ODDS = ['-200', '-150', '-110', '+100', '+150', '+200'];
const BET_TYPES = ['Moneyline', 'Spread', 'Total', 'Parlay', 'Prop'];
const SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'Soccer', 'MMA', 'Tennis', 'Other'];
const DEFAULT_STAKE_CHIPS = ['5', '10', '25', '50', '100', '250', '500'];

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
  const { currencySymbol = '$', quickChipsEnabled, quickChipPresets } = usePreferences();
  const stakeChips =
    Array.isArray(quickChipPresets?.sports) && quickChipPresets.sports.length > 0
      ? quickChipPresets.sports
      : DEFAULT_STAKE_CHIPS;
  const { user } = useAuth();
  
  const {
    activeSession,
    startSession,
    logHandToActiveSession,
    removeHandFromActiveSession,
    updateHandInActiveSession,
    endActiveSession,
    discardActiveSession,
  } = useActiveSession();

  useEffect(() => {
    if (!activeSession || activeSession.gameType !== 'Sports Betting') {
      startSession('Sports Betting');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [betType, setBetType] = useState('Moneyline');
  const [matchup, setMatchup] = useState('');
  const [sport, setSport] = useState(null);
  const [line, setLine] = useState('');
  const [live, setLive] = useState(false);
  const [stake, setStake] = useState('');
  const [odds, setOdds] = useState('');
  const [expandedBetId, setExpandedBetId] = useState(null);

  const [showEndWarning, setShowEndWarning] = useState(false);

  const resetForm = () => {
    setMatchup('');
    setSport(null);
    setLine('');
    setLive(false);
    setStake('');
    setOdds('');
  };

  const handleStakeChipPress = (chipValue) => {
    hapticLight();
    const current = parseFloat(stake) || 0;
    setStake(String(current + parseFloat(chipValue)));
  };

  const parsedStake = parseFloat(stake);
  const parsedOdds = parseFloat(odds);
  const hasValidStake = stake !== '' && !isNaN(parsedStake) && parsedStake > 0;
  const hasValidOdds = odds !== '' && !isNaN(parsedOdds) && parsedOdds !== 0;

  const showLineField = betType === 'Spread' || betType === 'Total';
  const isParlay = betType === 'Parlay';
  const isProp = betType === 'Prop';

  const projectedPayout = hasValidStake && hasValidOdds ? calcPayout(parsedStake, odds) : 0;

  const submitBet = () => {
    hapticLight();
    if (!hasValidStake || !hasValidOdds) return;

    const record = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      type: 'single',
      matchup: matchup.trim() || (isParlay ? 'Custom Parlay' : 'Untitled Bet'),
      sport: sport || undefined,
      betType,
      line: showLineField && line.trim() ? line.trim() : undefined,
      live,
      bet: parsedStake,
      odds: parsedOdds,
      outcome: 'pending',
      netChange: 0,
      createdAt: Date.now(),
    };

    logHandToActiveSession(record);
    resetForm();
  };

  const resolveBet = (betId, b, outcome) => {
    hapticLight();
    let netChange = 0;
    if (outcome === 'win') {
      const pOdds = parseFloat(b.odds);
      if (pOdds > 0) {
        netChange = b.bet * (pOdds / 100);
      } else {
        netChange = b.bet * (100 / Math.abs(pOdds));
      }
    } else if (outcome === 'loss') {
      netChange = -b.bet;
    }
    updateHandInActiveSession(betId, { outcome, netChange });
  };

  const sessionBets = activeSession?.hands || [];
  const totalNet = sessionBets.reduce((sum, b) => sum + (b.netChange || 0), 0);
  const wins = sessionBets.filter((b) => b.outcome === 'win').length;
  const losses = sessionBets.filter((b) => b.outcome === 'loss').length;
  const pushes = sessionBets.filter((b) => b.outcome === 'push').length;

  const handleEndSessionPress = () => {
    hapticSuccess();
    if (sessionBets.length === 0) {
      discardActiveSession();
      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }

    const hasPending = sessionBets.some((b) => b.outcome === 'pending');
    if (hasPending) {
      setShowEndWarning(true);
      return;
    }

    executeEndSession();
  };

  const executeEndSession = () => {
    setShowEndWarning(false);
    endActiveSession();
    navigation.navigate('MainTabs', { screen: 'History' });
  };

  const canSubmit = hasValidStake && hasValidOdds;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ConfirmModal
        visible={showEndWarning}
        title="Pending Bets Remaining"
        message="You have unresolved pending bets in this session. If you end the session now, they will be saved to your history as unresolved and cannot be edited later.\n\nAre you sure you want to end this session?"
        confirmText="End Session"
        cancelText="Cancel"
        variant="danger"
        icon="alert-circle-outline"
        onConfirm={executeEndSession}
        onCancel={() => setShowEndWarning(false)}
      />
      <View style={[styles.topNav, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <LivePulseDot size={8} color={COLORS.danger} />
          <Text style={[styles.navTitle, { marginLeft: 8 }]}>Bet Slip Tracker</Text>
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
        {!user && <GuestModeBanner />}

        {/* SESSION STATS */}
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
            {totalNet > 0 ? '+' : totalNet < 0 ? '-' : ''}{currencySymbol}{Math.abs(totalNet).toFixed(2)}
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

        {/* BET TYPE SELECTOR */}
        <View style={styles.betTypeWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.betTypeScroll}>
            {BET_TYPES.map((type) => {
              const active = betType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeTab, active && styles.typeTabActive]}
                  onPress={() => {
                    setBetType(type);
                    hapticLight();
                  }}
                >
                  <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>{type}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* BET DETAILS SECTION */}
        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.cardTitle}>Bet Details</Text>
          </View>

          {!isParlay && (
            <>
              <Text style={styles.label}>Sport (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={styles.chipWrapRowHorizontal}>
                  {SPORTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sportChip, sport === s && styles.sportChipActive]}
                      onPress={() => setSport(sport === s ? null : s)}
                    >
                      <Text style={[styles.sportChipText, sport === s && styles.sportChipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          <Text style={styles.label}>
            {isParlay ? 'Parlay Description' : isProp ? 'Prop Details (e.g. LeBron O 25.5 Pts)' : 'Matchup'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={isParlay ? "e.g. 4-Leg NFL Sunday" : "e.g. Lakers vs Celtics"}
            placeholderTextColor={COLORS.textMuted}
            value={matchup}
            onChangeText={setMatchup}
          />

          {showLineField && (
            <>
              <Text style={styles.label}>{betType === 'Spread' ? 'Spread Line' : 'Total Line'}</Text>
              <TextInput
                style={styles.input}
                placeholder={betType === 'Spread' ? 'e.g. -3.5' : 'e.g. O 220.5'}
                placeholderTextColor={COLORS.textMuted}
                value={line}
                onChangeText={setLine}
              />
            </>
          )}

          {!isParlay && (
            <View style={styles.liveToggleRow}>
              <TouchableOpacity
                style={[styles.liveToggleBtn, !live && styles.liveToggleBtnActive]}
                onPress={() => setLive(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.liveToggleText, !live && styles.liveToggleTextActive]}>Pregame</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.liveToggleBtn, live && styles.liveToggleBtnLiveActive]}
                onPress={() => setLive(true)}
                activeOpacity={0.8}
              >
                <LivePulseDot size={8} color={live ? COLORS.danger : COLORS.textSecondary} />
                <Text style={[styles.liveToggleText, live && styles.liveToggleTextActive, { marginLeft: 6 }]}>Live</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* STAKE & ODDS SECTION */}
        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.cardHeader}>
            <Ionicons name="cash-outline" size={16} color={COLORS.success} style={{ marginRight: 6 }} />
            <Text style={styles.cardTitle}>Stake & Odds</Text>
          </View>
          
          <View style={styles.rowInputs}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Stake ({currencySymbol})</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 50"
                placeholderTextColor={COLORS.textMuted}
                value={stake}
                onChangeText={setStake}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Odds</Text>
              <TextInput
                style={styles.input}
                keyboardType="numbers-and-punctuation"
                placeholder="e.g. -110"
                placeholderTextColor={COLORS.textMuted}
                value={odds}
                onChangeText={setOdds}
              />
            </View>
          </View>

          {/* Quick Chips for Stake and Odds */}
          <View style={styles.quickActionContainer}>
            {quickChipsEnabled && (
              <View style={styles.quickChipsCol}>
                <Text style={styles.quickActionLabel}>+ Stake</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipWrapRowHorizontal}>
                    {stakeChips.map((chip) => (
                      <TouchableOpacity key={chip} style={styles.stakeChip} onPress={() => handleStakeChipPress(chip)}>
                        <Text style={styles.stakeChipText}>{chip}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            
            <View style={styles.quickChipsCol}>
              <Text style={styles.quickActionLabel}>Set Odds</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipWrapRowHorizontal}>
                  {COMMON_ODDS.map((o) => (
                    <TouchableOpacity key={o} style={[styles.oddsChip, odds === o && styles.oddsChipActive]} onPress={() => setOdds(o)}>
                      <Text style={[styles.oddsChipText, odds === o && styles.oddsChipTextActive]}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {hasValidStake && hasValidOdds && (
            <View style={styles.payoutPreview}>
              <View style={styles.payoutPreviewRow}>
                <Text style={styles.payoutPreviewLabel}>TO WIN</Text>
                <View style={[styles.favDogBadge, { backgroundColor: parsedOdds < 0 ? COLORS.primaryMuted : COLORS.accentCyanMuted }]}>
                  <Text style={[styles.favDogBadgeText, { color: parsedOdds < 0 ? COLORS.primary : COLORS.accentCyan }]}>
                    {parsedOdds < 0 ? 'FAV' : 'DOG'}
                  </Text>
                </View>
              </View>
              <Text style={styles.payoutPreviewValue}>+{currencySymbol}{projectedPayout.toFixed(2)}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitDisabled]}
            onPress={submitBet}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>Add to Bet Slip</Text>
          </TouchableOpacity>
        </View>

        {/* SESSION BETS LIST */}
        {sessionBets.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-outline" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.cardTitle}>Session Bets ({sessionBets.length})</Text>
            </View>
            <Text style={styles.swipeHint}>Swipe a bet to delete • Tap to resolve</Text>

            {sessionBets.map((b) => {
              const isExpanded = expandedBetId === b.id;
              const isFav = b.odds < 0;
              const isPending = b.outcome === 'pending';
              return (
                <SwipeableRow
                  key={b.id}
                  onDelete={() => removeHandFromActiveSession(b.id)}
                  confirmTitle="Delete this bet?"
                  confirmMessage="This cannot be undone."
                >
                  <TouchableOpacity
                    style={[styles.historyRow, isExpanded && styles.historyRowExpanded]}
                    activeOpacity={0.8}
                    onPress={() => setExpandedBetId((prev) => (prev === b.id ? null : b.id))}
                  >
                    <View style={styles.historyRowTop}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.historyBadgeRow}>
                          <View style={styles.betTypeBadge}>
                            <Text style={styles.betTypeBadgeText}>{b.betType}</Text>
                          </View>
                          {b.live && (
                            <View style={styles.liveBadge}>
                              <Text style={styles.liveBadgeText}>LIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.historyText} numberOfLines={1}>
                          {b.matchup}
                        </Text>
                        <Text style={styles.historySubtext}>
                          {currencySymbol}{b.bet} @ {b.odds > 0 ? '+' : ''}{b.odds}
                          {b.sport ? ` • ${b.sport}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                         {isPending ? (
                           <>
                             <Text style={styles.pendingStatusText}>Pending</Text>
                             <Text style={styles.potentialPayoutText}>
                               To win {currencySymbol}{calcPayout(b.bet, b.odds).toFixed(2)}
                             </Text>
                           </>
                         ) : (
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
                             {b.netChange > 0 ? '+' : b.netChange < 0 ? '-' : ''}{currencySymbol}{Math.abs(b.netChange).toFixed(2)}
                           </Text>
                         )}
                      </View>
                    </View>

                    {isExpanded && (
                      <View style={styles.expandedBreakdown}>
                        <View style={styles.expandedDivider} />
                        {b.line && (
                          <View style={{ marginBottom: 12 }}>
                            <Text style={styles.metaChipText}>Line: <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{b.line}</Text></Text>
                          </View>
                        )}
                        <Text style={styles.resolvePrompt}>{isPending ? 'What was the outcome?' : 'Update outcome'}</Text>
                        <View style={styles.outcomeActionRow}>
                          <TouchableOpacity
                            style={[
                              styles.outcomeButtonSmall,
                              b.outcome === 'win' 
                                ? { backgroundColor: COLORS.success, borderColor: COLORS.success }
                                : { backgroundColor: COLORS.backgroundSecondary, borderColor: COLORS.cardBorder }
                            ]}
                            onPress={() => resolveBet(b.id, b, 'win')}
                          >
                            <Text style={[styles.outcomeButtonSmallText, b.outcome === 'win' ? { color: COLORS.textDark } : { color: COLORS.success }]}>Win</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.outcomeButtonSmall,
                              b.outcome === 'loss' 
                                ? { backgroundColor: COLORS.danger, borderColor: COLORS.danger }
                                : { backgroundColor: COLORS.backgroundSecondary, borderColor: COLORS.cardBorder }
                            ]}
                            onPress={() => resolveBet(b.id, b, 'loss')}
                          >
                            <Text style={[styles.outcomeButtonSmallText, b.outcome === 'loss' ? { color: COLORS.textDark } : { color: COLORS.danger }]}>Loss</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.outcomeButtonSmall,
                              b.outcome === 'push' 
                                ? { backgroundColor: COLORS.neutral, borderColor: COLORS.neutralBorder }
                                : { backgroundColor: COLORS.backgroundSecondary, borderColor: COLORS.cardBorder }
                            ]}
                            onPress={() => resolveBet(b.id, b, 'push')}
                          >
                            <Text style={[styles.outcomeButtonSmallText, b.outcome === 'push' ? { color: COLORS.textDark } : { color: COLORS.textSecondary }]}>Push</Text>
                          </TouchableOpacity>
                          
                          {!isPending && (
                            <TouchableOpacity
                              style={[
                                styles.outcomeButtonSmall,
                                { backgroundColor: COLORS.backgroundSecondary, borderColor: COLORS.cardBorder }
                              ]}
                              onPress={() => resolveBet(b.id, b, 'pending')}
                            >
                              <Text style={[styles.outcomeButtonSmallText, { color: COLORS.warning }]}>Pending</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </SwipeableRow>
              );
            })}
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
  betTypeWrapper: { marginBottom: 16 },
  betTypeScroll: { paddingRight: 16, gap: 8, flexDirection: 'row' },
  typeTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...SHADOWS.card,
  },
  typeTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeTabText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  typeTabTextActive: { color: COLORS.textDark, fontWeight: '700' },
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
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  chipWrapRowHorizontal: { flexDirection: 'row', gap: 8 },
  sportChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sportChipActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  sportChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  sportChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  liveToggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  liveToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  liveToggleBtnActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  liveToggleBtnLiveActive: { backgroundColor: COLORS.warningMuted, borderColor: COLORS.warning },
  liveToggleText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  liveToggleTextActive: { color: COLORS.textPrimary, fontWeight: '700' },
  quickActionContainer: { flexDirection: 'column', gap: 12, marginBottom: 16 },
  quickChipsCol: { width: '100%', overflow: 'hidden' },
  quickActionLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  stakeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stakeChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  oddsChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  payoutPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  payoutPreviewLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  payoutPreviewValue: { fontSize: 24, fontWeight: '700', color: COLORS.success },
  favDogBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  favDogBadgeText: { fontSize: 9, fontWeight: '700' },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: COLORS.cardBorder, opacity: 0.5 },
  submitText: { color: COLORS.textDark, fontWeight: '700', fontSize: 15 },
  historySection: { marginTop: 8 },
  swipeHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12, textAlign: 'center' },
  historyRow: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  historyRowExpanded: {
    borderColor: COLORS.primaryMuted,
  },
  historyRowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  historyBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  betTypeBadge: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  betTypeBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  liveBadge: {
    backgroundColor: COLORS.warningMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  liveBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.warning },
  historyText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  historySubtext: { color: COLORS.textSecondary, fontSize: 12 },
  historyNet: { fontSize: 14, fontWeight: '700' },
  pendingStatusText: { fontWeight: '700', fontSize: 13, color: COLORS.warning, marginBottom: 2 },
  potentialPayoutText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  expandedBreakdown: { marginTop: 12 },
  expandedDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginBottom: 12 },
  metaChipText: { fontSize: 12, color: COLORS.textSecondary },
  resolvePrompt: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  outcomeActionRow: { flexDirection: 'row', gap: 8 },
  outcomeButtonSmall: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  outcomeButtonSmallText: { fontWeight: '700', fontSize: 14 },
});
