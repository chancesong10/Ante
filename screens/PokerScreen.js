import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import { usePreferences } from '../context/PreferencesContext';
import SwipeableRow from '../components/SwipeableRow';

const STREETS = [
  { key: 'preflop', label: 'Pre-Flop', short: 'Pre' },
  { key: 'flop', label: 'Flop', short: 'Flop' },
  { key: 'turn', label: 'Turn (4th)', short: 'Turn' },
  { key: 'river', label: 'River (5th)', short: 'River' },
  { key: 'showdown', label: 'Showdown', short: 'Result' },
];

const BLIND_PRESETS = [
  { label: '$1 / $2', sb: 1, bb: 2 },
  { label: '$1 / $3', sb: 1, bb: 3 },
  { label: '$2 / $5', sb: 2, bb: 5 },
  { label: '$5 / $10', sb: 5, bb: 10 },
  { label: 'No Blinds', sb: 0, bb: 0 },
];

export default function PokerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currencySymbol = '$' } = usePreferences();
  const {
    activeSession,
    startSession,
    updateActiveSessionMetadata,
    logHandToActiveSession,
    removeHandFromActiveSession,
    endActiveSession,
    discardActiveSession,
  } = useSession();

  // Screen View Mode: 'setup' | 'dashboard' | 'hand'
  const [viewMode, setViewMode] = useState('setup');

  // --- Session Configuration State ---
  const [smallBlind, setSmallBlind] = useState('1');
  const [bigBlind, setBigBlind] = useState('2');
  const [hasBlinds, setHasBlinds] = useState(true);
  const [chipDenominations, setChipDenominations] = useState(['1', '5', '25', '50', '100', '500']);

  // Ensure active session is initialized
  useEffect(() => {
    if (!activeSession) {
      startSession('Poker');
    } else if (activeSession.gameType === 'Poker' && activeSession.chipDenominations) {
      setSmallBlind(String(activeSession.smallBlind !== undefined && activeSession.smallBlind !== null ? activeSession.smallBlind : '1'));
      setBigBlind(String(activeSession.bigBlind !== undefined && activeSession.bigBlind !== null ? activeSession.bigBlind : '2'));
      setHasBlinds(Boolean(activeSession.smallBlind || activeSession.bigBlind));
      if (Array.isArray(activeSession.chipDenominations) && activeSession.chipDenominations.length > 0) {
        setChipDenominations(activeSession.chipDenominations.map(String));
      }
      setViewMode('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Active Hand Tracking State ---
  const [currentStreetIdx, setCurrentStreetIdx] = useState(0);
  const [heroPosition, setHeroPosition] = useState('None'); // 'None' | 'SB' | 'BB' | 'IP' | 'OOP'
  const [activePlayers, setActivePlayers] = useState(6);

  // Street by street contributions
  const [streetBets, setStreetBets] = useState({
    preflop: 0,
    flop: 0,
    turn: 0,
    river: 0,
  });

  // Table pot tracking
  const [potPreFlop, setPotPreFlop] = useState(0);
  const [potFlop, setPotFlop] = useState(0);
  const [potTurn, setPotTurn] = useState(0);
  const [potRiver, setPotRiver] = useState(0);
  const [deadMoney, setDeadMoney] = useState(0);
  const [manualPotOverride, setManualPotOverride] = useState('');
  const [isEditingPotDirectly, setIsEditingPotDirectly] = useState(false);

  // Raise / Re-raise table action modal
  const [raiseModalVisible, setRaiseModalVisible] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState('');
  const [callersCount, setCallersCount] = useState(1);

  // Dead money / Player folded modal
  const [deadMoneyModalVisible, setDeadMoneyModalVisible] = useState(false);
  const [deadMoneyAmount, setDeadMoneyAmount] = useState('');

  // Early Fold Modal & Assessment
  const [foldModalVisible, setFoldModalVisible] = useState(false);

  // Showdown State
  const [showdownResult, setShowdownResult] = useState('win'); // 'win' | 'split' | 'loss'
  const [splitWay, setSplitWay] = useState(2); // 2, 3, 4

  // Expanded Hand Row in Dashboard
  const [expandedHandId, setExpandedHandId] = useState(null);

  // Swipe detection ref
  const touchStartX = useRef(0);

  // Calculated totals
  const currentStreetKey = STREETS[currentStreetIdx]?.key || 'preflop';
  const heroTotalInvestment =
    (streetBets.preflop || 0) +
    (streetBets.flop || 0) +
    (streetBets.turn || 0) +
    (streetBets.river || 0);

  const calculatedTotalPot =
    (potPreFlop || 0) +
    (potFlop || 0) +
    (potTurn || 0) +
    (potRiver || 0) +
    (deadMoney || 0) +
    heroTotalInvestment;

  const effectiveTotalPot =
    manualPotOverride !== '' && !isNaN(parseFloat(manualPotOverride))
      ? parseFloat(manualPotOverride)
      : Math.max(calculatedTotalPot, heroTotalInvestment);

  // --- Handlers: Session Setup ---
  const handlePresetSelect = (preset) => {
    if (preset.sb === 0 && preset.bb === 0) {
      setHasBlinds(false);
      setSmallBlind('0');
      setBigBlind('0');
    } else {
      setHasBlinds(true);
      setSmallBlind(String(preset.sb));
      setBigBlind(String(preset.bb));
      // Auto-scale chip recommendations
      if (preset.bb >= 5) {
        setChipDenominations(['2', '5', '25', '100', '500', '1000']);
      } else {
        setChipDenominations(['1', '5', '25', '50', '100', '500']);
      }
    }
  };

  const handleFinishSetup = () => {
    const sb = hasBlinds ? parseFloat(smallBlind) || 0 : 0;
    const bb = hasBlinds ? parseFloat(bigBlind) || 0 : 0;
    const validChips = chipDenominations.map((c) => parseFloat(c)).filter((n) => !isNaN(n) && n > 0);

    const chips = validChips.length > 0 ? validChips : [1, 5, 25, 50, 100, 500];

    updateActiveSessionMetadata({
      smallBlind: sb,
      bigBlind: bb,
      chipDenominations: chips,
    });

    setViewMode('dashboard');
  };

  // --- Handlers: Start New Hand ---
  const handleStartNewHand = () => {
    const sbVal = activeSession && activeSession.smallBlind !== undefined ? activeSession.smallBlind : (hasBlinds ? parseFloat(smallBlind) || 1 : 0);
    const bbVal = activeSession && activeSession.bigBlind !== undefined ? activeSession.bigBlind : (hasBlinds ? parseFloat(bigBlind) || 2 : 0);

    // Initial estimated table pot from blinds if enabled (e.g. SB + BB from blinds players)
    const initialTablePot = sbVal > 0 || bbVal > 0 ? sbVal + bbVal : 0;

    setCurrentStreetIdx(0);
    setHeroPosition('None');
    setActivePlayers(6);
    setStreetBets({ preflop: 0, flop: 0, turn: 0, river: 0 });
    setPotPreFlop(initialTablePot);
    setPotFlop(0);
    setPotTurn(0);
    setPotRiver(0);
    setDeadMoney(0);
    setManualPotOverride('');
    setIsEditingPotDirectly(false);
    setShowdownResult('win');
    setSplitWay(2);

    setViewMode('hand');
  };

  // --- Handlers: Incremental Quick Chips for Hero Bet ---
  const handleHeroChipPress = (chipValue) => {
    const val = parseFloat(chipValue) || 0;
    const current = streetBets[currentStreetKey] || 0;
    const updated = current + val;
    setStreetBets((prev) => ({
      ...prev,
      [currentStreetKey]: updated,
    }));
  };

  const handleHeroClearBet = () => {
    setStreetBets((prev) => ({
      ...prev,
      [currentStreetKey]: 0,
    }));
  };

  const handleHeroDirectBetChange = (text) => {
    const val = parseFloat(text) || 0;
    setStreetBets((prev) => ({
      ...prev,
      [currentStreetKey]: val,
    }));
  };

  // --- Handlers: Hero Position Selector ---
  const handlePositionSelect = (pos) => {
    setHeroPosition(pos);
    const sbVal = activeSession && activeSession.smallBlind !== undefined ? activeSession.smallBlind : (hasBlinds ? parseFloat(smallBlind) || 1 : 0);
    const bbVal = activeSession && activeSession.bigBlind !== undefined ? activeSession.bigBlind : (hasBlinds ? parseFloat(bigBlind) || 2 : 0);

    if (pos === 'SB' && sbVal > 0) {
      setStreetBets((prev) => ({
        ...prev,
        preflop: sbVal,
      }));
    } else if (pos === 'BB' && bbVal > 0) {
      setStreetBets((prev) => ({
        ...prev,
        preflop: bbVal,
      }));
    }
  };

  // --- Handlers: Table Raises & Pot Builder ---
  const handleApplyTableRaise = () => {
    const rAmt = parseFloat(raiseAmount);
    if (isNaN(rAmt) || rAmt <= 0) {
      setRaiseModalVisible(false);
      return;
    }
    const callers = parseInt(callersCount, 10) || 1;
    const addedPot = rAmt * (1 + callers);

    if (currentStreetKey === 'preflop') setPotPreFlop((p) => p + addedPot);
    else if (currentStreetKey === 'flop') setPotFlop((p) => p + addedPot);
    else if (currentStreetKey === 'turn') setPotTurn((p) => p + addedPot);
    else if (currentStreetKey === 'river') setPotRiver((p) => p + addedPot);

    setRaiseAmount('');
    setCallersCount(1);
    setRaiseModalVisible(false);
  };

  const handleApplyDeadMoneyFold = () => {
    const dAmt = parseFloat(deadMoneyAmount);
    if (!isNaN(dAmt) && dAmt > 0) {
      setDeadMoney((prev) => prev + dAmt);
      setActivePlayers((p) => Math.max(2, p - 1));
    }
    setDeadMoneyAmount('');
    setDeadMoneyModalVisible(false);
  };

  // --- Handlers: Early Fold ---
  const handleConfirmFold = (foldReason) => {
    setFoldModalVisible(false);

    const handRecord = {
      id: Date.now(),
      gameType: 'Poker',
      position: heroPosition,
      outcome: 'fold',
      foldReason, // 'bluffed' | 'good_fold' | 'no_show'
      streetFolded: STREETS[currentStreetIdx]?.label || 'Pre-Flop',
      heroInvestment: heroTotalInvestment,
      pot: effectiveTotalPot,
      netChange: -heroTotalInvestment,
      streets: { ...streetBets },
      timestamp: Date.now(),
    };

    logHandToActiveSession(handRecord);
    setViewMode('dashboard');
  };

  // --- Handlers: Save Showdown Hand ---
  const handleSaveShowdownHand = () => {
    let netChange = 0;
    if (showdownResult === 'win') {
      netChange = effectiveTotalPot - heroTotalInvestment;
    } else if (showdownResult === 'split') {
      const splitPot = effectiveTotalPot / splitWay;
      netChange = splitPot - heroTotalInvestment;
    } else {
      netChange = -heroTotalInvestment;
    }

    const handRecord = {
      id: Date.now(),
      gameType: 'Poker',
      position: heroPosition,
      outcome: showdownResult,
      splitCount: showdownResult === 'split' ? splitWay : 1,
      heroInvestment: heroTotalInvestment,
      pot: effectiveTotalPot,
      netChange,
      streets: { ...streetBets },
      timestamp: Date.now(),
    };

    logHandToActiveSession(handRecord);
    setViewMode('dashboard');
  };

  // --- Handlers: Street Swipe Navigation ---
  const handleTouchStart = (e) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.nativeEvent.pageX;
    const deltaX = touchEndX - touchStartX.current;

    // Minimum swipe threshold
    if (Math.abs(deltaX) > 60) {
      if (deltaX < 0 && currentStreetIdx < STREETS.length - 1) {
        // Swiped Left -> Next street
        setCurrentStreetIdx((prev) => prev + 1);
      } else if (deltaX > 0 && currentStreetIdx > 0) {
        // Swiped Right -> Previous street
        setCurrentStreetIdx((prev) => prev - 1);
      }
    }
  };

  // --- Handlers: Session Discard & End ---
  const handleEndSessionPress = () => {
    const hands = activeSession?.hands || [];
    if (hands.length === 0) {
      discardActiveSession();
      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }

    endActiveSession();
    navigation.navigate('MainTabs', { screen: 'History' });
  };

  const handleDiscardPress = () => {
    Alert.alert(
      'Discard this session?',
      'Nothing from this live session will be saved. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            discardActiveSession();
            navigation.navigate('MainTabs', { screen: 'Home' });
          },
        },
      ]
    );
  };

  // --- Session Stats Computation ---
  const sessionHands = activeSession?.hands || [];
  const totalHandsCount = sessionHands.length;
  const winsCount = sessionHands.filter((h) => h.outcome === 'win').length;
  const lossesCount = sessionHands.filter((h) => h.outcome === 'loss').length;
  const foldsCount = sessionHands.filter((h) => h.outcome === 'fold').length;
  const bluffsCount = sessionHands.filter((h) => h.outcome === 'fold' && h.foldReason === 'bluffed').length;
  const goodFoldsCount = sessionHands.filter((h) => h.outcome === 'fold' && h.foldReason === 'good_fold').length;
  const sessionTotalNet = sessionHands.reduce((sum, h) => sum + (h.netChange || 0), 0);
  const winRatePercent =
    winsCount + lossesCount + foldsCount > 0
      ? ((winsCount / (winsCount + lossesCount + foldsCount)) * 100).toFixed(1)
      : '0.0';

  // ==========================================
  // VIEW 1: INITIAL SESSION SETUP
  // ==========================================
  if (viewMode === 'setup') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          >
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.navTitleContainer}>
            <MaterialCommunityIcons name="cards-playing-outline" size={20} color={COLORS.primary} />
            <Text style={styles.navTitle}>Poker Setup</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + moderateScale(40) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, SHADOWS.card]}>
            <Text style={styles.sectionHeaderTitle}>Select Table Blinds</Text>
            <Text style={styles.cardSubtitle}>
              Choose a standard blind level or input your custom stakes.
            </Text>

            {/* Blind Presets */}
            <View style={styles.presetRow}>
              {BLIND_PRESETS.map((preset) => {
                const isSelected =
                  hasBlinds
                    ? preset.sb === parseFloat(smallBlind) && preset.bb === parseFloat(bigBlind)
                    : preset.sb === 0 && preset.bb === 0;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.presetButton, isSelected && styles.presetButtonActive]}
                    onPress={() => handlePresetSelect(preset)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {hasBlinds && (
              <View style={styles.customBlindRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.label}>Small Blind ({currencySymbol})</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={COLORS.textMuted}
                    value={smallBlind}
                    onChangeText={setSmallBlind}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.label}>Big Blind ({currencySymbol})</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="2"
                    placeholderTextColor={COLORS.textMuted}
                    value={bigBlind}
                    onChangeText={setBigBlind}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Quick-Chip Denominations */}
          <View style={[styles.card, SHADOWS.card]}>
            <Text style={styles.sectionHeaderTitle}>Quick-Chip Denominations</Text>
            <Text style={styles.cardSubtitle}>
              These 6 chip increments will appear during your hand rounds. Tapping them will incrementally add to your bet.
            </Text>

            <View style={styles.chipConfigGrid}>
              {chipDenominations.map((chip, idx) => (
                <View key={idx} style={styles.chipConfigBox}>
                  <Text style={styles.chipConfigLabel}>Chip {idx + 1}</Text>
                  <View style={styles.chipInputWrapper}>
                    <Text style={styles.chipCurrencyPrefix}>{currencySymbol}</Text>
                    <TextInput
                      style={styles.chipConfigInput}
                      keyboardType="numeric"
                      value={chip}
                      onChangeText={(val) => {
                        const updated = [...chipDenominations];
                        updated[idx] = val;
                        setChipDenominations(updated);
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, SHADOWS.card]}
            activeOpacity={0.85}
            onPress={handleFinishSetup}
          >
            <Ionicons name="checkmark-circle" size={20} color={COLORS.textDark} style={{ marginRight: 8 }} />
            <Text style={styles.submitText}>Start Poker Session</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ==========================================
  // VIEW 2: MULTI-PHASE HAND TRACKER
  // ==========================================
  if (viewMode === 'hand') {
    const isPreFlop = currentStreetIdx === 0;
    const isShowdown = currentStreetIdx === 4;
    const currentHeroBet = streetBets[currentStreetKey] || 0;

    return (
      <View
        style={[styles.container, { paddingTop: insets.top }]}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Header */}
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              Alert.alert('Cancel this hand?', 'Progress for this hand will be lost.', [
                { text: 'Keep Tracking', style: 'cancel' },
                { text: 'Cancel Hand', style: 'destructive', onPress: () => setViewMode('dashboard') },
              ]);
            }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <View style={styles.liveIndicatorDot} />
            <Text style={styles.navTitle}>
              Hand #{totalHandsCount + 1} • {STREETS[currentStreetIdx]?.label}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.foldHeaderButton}
            onPress={() => setFoldModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.danger} style={{ marginRight: 4 }} />
            <Text style={styles.foldHeaderText}>Fold</Text>
          </TouchableOpacity>
        </View>

        {/* Street Step Progress Bar */}
        <View style={styles.stepperBar}>
          {STREETS.map((st, idx) => {
            const isActive = idx === currentStreetIdx;
            const isCompleted = idx < currentStreetIdx;
            return (
              <TouchableOpacity
                key={st.key}
                style={[
                  styles.stepTab,
                  isActive && styles.stepTabActive,
                  isCompleted && styles.stepTabCompleted,
                ]}
                onPress={() => setCurrentStreetIdx(idx)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.stepTabText,
                    isActive && styles.stepTabTextActive,
                    isCompleted && styles.stepTabTextCompleted,
                  ]}
                >
                  {st.short}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + moderateScale(110) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Pot & Investment Overview Card */}
          <View style={[styles.statsBox, SHADOWS.card]}>
            <View style={styles.potHeaderRow}>
              <View>
                <Text style={styles.statsSubtext}>TOTAL TABLE POT</Text>
                <TouchableOpacity
                  onPress={() => setIsEditingPotDirectly(!isEditingPotDirectly)}
                  style={styles.potValueRow}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.netAmount, { color: COLORS.primary }]}>
                    {currencySymbol}
                    {effectiveTotalPot.toFixed(2)}
                  </Text>
                  <Ionicons
                    name="pencil-outline"
                    size={16}
                    color={COLORS.textMuted}
                    style={{ marginLeft: 6, marginBottom: 8 }}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.heroInvestmentBadge}>
                <Text style={styles.heroInvestmentLabel}>Your Total Bet</Text>
                <Text style={styles.heroInvestmentValue}>
                  {currencySymbol}
                  {heroTotalInvestment.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Direct Pot Edit Field */}
            {isEditingPotDirectly && (
              <View style={styles.directPotEditBox}>
                <Text style={styles.directPotEditHint}>Override Pot Amount Directly:</Text>
                <TextInput
                  style={styles.directPotInput}
                  keyboardType="numeric"
                  placeholder={String(effectiveTotalPot)}
                  placeholderTextColor={COLORS.textMuted}
                  value={manualPotOverride}
                  onChangeText={setManualPotOverride}
                />
              </View>
            )}

            {/* Active Players Row */}
            <View style={styles.activePlayersRow}>
              <Text style={styles.activePlayersLabel}>Active Players in Hand:</Text>
              <View style={styles.stepperControl}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setActivePlayers((p) => Math.max(2, p - 1))}
                >
                  <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{activePlayers} Players</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setActivePlayers((p) => Math.min(10, p + 1))}
                >
                  <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* NON-SHOWDOWN STREETS (Pre-Flop, Flop, Turn, River) */}
          {!isShowdown ? (
            <>
              {/* Pre-Flop Position Shortcuts */}
              {isPreFlop && (
                <View style={[styles.card, SHADOWS.card]}>
                  <Text style={styles.label}>Your Position</Text>
                  <View style={styles.positionRow}>
                    {['SB', 'BB', 'IP', 'OOP', 'None'].map((pos) => {
                      const isSel = heroPosition === pos;
                      return (
                        <TouchableOpacity
                          key={pos}
                          style={[styles.positionBtn, isSel && styles.positionBtnActive]}
                          onPress={() => handlePositionSelect(pos)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.positionText, isSel && styles.positionTextActive]}>
                            {pos}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Hero's Bet for Current Street */}
              <View style={[styles.card, SHADOWS.card]}>
                <View style={styles.streetBetHeader}>
                  <Text style={styles.sectionHeaderTitle}>
                    Your {STREETS[currentStreetIdx]?.label} Bet
                  </Text>
                  {currentHeroBet > 0 && (
                    <TouchableOpacity onPress={handleHeroClearBet} style={styles.clearBtn}>
                      <Ionicons name="refresh" size={14} color={COLORS.danger} style={{ marginRight: 3 }} />
                      <Text style={styles.clearBtnText}>Reset $0</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.heroBetDisplayRow}>
                  <Text style={styles.heroBetSymbol}>{currencySymbol}</Text>
                  <TextInput
                    style={styles.heroBetInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                    value={currentHeroBet > 0 ? String(currentHeroBet) : ''}
                    onChangeText={handleHeroDirectBetChange}
                  />
                  <Text style={styles.heroBetPhaseTag}>
                    {currentHeroBet === 0 ? 'Check / $0' : 'Committed'}
                  </Text>
                </View>

                {/* Incremental Quick Chips */}
                <Text style={styles.chipRowLabel}>Tap Chips to Increment Bet:</Text>
                <View style={styles.chipGrid}>
                  {chipDenominations.map((chip) => (
                    <TouchableOpacity
                      key={chip}
                      style={styles.chipButton}
                      onPress={() => handleHeroChipPress(chip)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.chipInnerCircle}>
                        <Text style={styles.chipText}>
                          +{currencySymbol}
                          {chip}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Table Action & Opponent Raise Log */}
              <View style={[styles.card, SHADOWS.card]}>
                <Text style={styles.sectionHeaderTitle}>Table Action & Raises</Text>
                <Text style={styles.cardSubtitle}>
                  Track opponent raises and callers to auto-calculate the total pot.
                </Text>

                <View style={styles.tableActionBtnRow}>
                  <TouchableOpacity
                    style={[styles.tableActionBtn, { borderColor: COLORS.primaryGlow }]}
                    onPress={() => setRaiseModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trending-up" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.tableActionBtnText}>Log Opponent Raise</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tableActionBtn, { borderColor: COLORS.neutralBorder }]}
                    onPress={() => setDeadMoneyModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-remove-outline" size={18} color={COLORS.neutral} style={{ marginRight: 6 }} />
                    <Text style={[styles.tableActionBtnText, { color: COLORS.textSecondary }]}>
                      Folded Player ($ in pot)
                    </Text>
                  </TouchableOpacity>
                </View>

                {deadMoney > 0 && (
                  <View style={styles.deadMoneyNotice}>
                    <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.deadMoneyText}>
                      Dead money retained in pot: {currencySymbol}{deadMoney.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            // SHOWDOWN STAGE (STAGE 5)
            <View style={[styles.card, SHADOWS.card]}>
              <Text style={styles.sectionHeaderTitle}>Hand Showdown</Text>
              <Text style={styles.cardSubtitle}>
                Select the outcome of the hand to calculate your final net profit or loss.
              </Text>

              {/* Showdown Outcome Selector */}
              <View style={styles.showdownRow}>
                <TouchableOpacity
                  style={[
                    styles.showdownOptionBtn,
                    showdownResult === 'win' && styles.showdownWinActive,
                  ]}
                  onPress={() => setShowdownResult('win')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="trophy"
                    size={22}
                    color={showdownResult === 'win' ? COLORS.textDark : COLORS.success}
                  />
                  <Text
                    style={[
                      styles.showdownOptionTitle,
                      showdownResult === 'win' && styles.showdownOptionTitleActive,
                    ]}
                  >
                    Won Pot
                  </Text>
                  <Text
                    style={[
                      styles.showdownOptionSub,
                      showdownResult === 'win' && styles.showdownOptionSubActive,
                    ]}
                  >
                    + {currencySymbol}{(effectiveTotalPot - heroTotalInvestment).toFixed(2)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.showdownOptionBtn,
                    showdownResult === 'split' && styles.showdownSplitActive,
                  ]}
                  onPress={() => setShowdownResult('split')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="git-compare-outline"
                    size={22}
                    color={showdownResult === 'split' ? COLORS.textDark : COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.showdownOptionTitle,
                      showdownResult === 'split' && styles.showdownOptionTitleActive,
                    ]}
                  >
                    Split / Chop
                  </Text>
                  <Text
                    style={[
                      styles.showdownOptionSub,
                      showdownResult === 'split' && styles.showdownOptionSubActive,
                    ]}
                  >
                    {splitWay}-Way
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.showdownOptionBtn,
                    showdownResult === 'loss' && styles.showdownLossActive,
                  ]}
                  onPress={() => setShowdownResult('loss')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="close-circle"
                    size={22}
                    color={showdownResult === 'loss' ? COLORS.textDark : COLORS.danger}
                  />
                  <Text
                    style={[
                      styles.showdownOptionTitle,
                      showdownResult === 'loss' && styles.showdownOptionTitleActive,
                    ]}
                  >
                    Lost Hand
                  </Text>
                  <Text
                    style={[
                      styles.showdownOptionSub,
                      showdownResult === 'loss' && styles.showdownOptionSubActive,
                    ]}
                  >
                    - {currencySymbol}{heroTotalInvestment.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Split Way selector */}
              {showdownResult === 'split' && (
                <View style={styles.splitWayRow}>
                  <Text style={styles.label}>Split Chopped Pot Ways:</Text>
                  <View style={styles.splitWayBtnGroup}>
                    {[2, 3, 4].map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={[styles.splitWayPill, splitWay === w && styles.splitWayPillActive]}
                        onPress={() => setSplitWay(w)}
                      >
                        <Text
                          style={[
                            styles.splitWayPillText,
                            splitWay === w && styles.splitWayPillTextActive,
                          ]}
                        >
                          {w}-Way Split ({currencySymbol}
                          {(effectiveTotalPot / w).toFixed(2)})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Final Net Calculation Summary Card */}
              <View style={styles.showdownSummaryBox}>
                <Text style={styles.showdownSummaryTitle}>PROJECTED HAND NET</Text>
                <Text
                  style={[
                    styles.showdownNetNumber,
                    {
                      color:
                        showdownResult === 'win'
                          ? COLORS.success
                          : showdownResult === 'loss'
                          ? COLORS.danger
                          : COLORS.primary,
                    },
                  ]}
                >
                  {showdownResult === 'win'
                    ? `+${currencySymbol}${(effectiveTotalPot - heroTotalInvestment).toFixed(2)}`
                    : showdownResult === 'split'
                    ? `${(effectiveTotalPot / splitWay - heroTotalInvestment) >= 0 ? '+' : ''}${currencySymbol}${(effectiveTotalPot / splitWay - heroTotalInvestment).toFixed(2)}`
                    : `-${currencySymbol}${heroTotalInvestment.toFixed(2)}`}
                </Text>
                <Text style={styles.showdownSummarySub}>
                  Total Pot: {currencySymbol}{effectiveTotalPot.toFixed(2)} • Your Bet: {currencySymbol}{heroTotalInvestment.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Floating Navigation Actions */}
        <View style={[styles.handBottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.handNavBtn, currentStreetIdx === 0 && styles.handNavBtnDisabled]}
            disabled={currentStreetIdx === 0}
            onPress={() => setCurrentStreetIdx((p) => Math.max(0, p - 1))}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.textPrimary} />
            <Text style={styles.handNavBtnText}>Back</Text>
          </TouchableOpacity>

          {!isShowdown ? (
            <TouchableOpacity
              style={[styles.handPrimaryBtn, SHADOWS.card]}
              onPress={() => setCurrentStreetIdx((p) => Math.min(STREETS.length - 1, p + 1))}
              activeOpacity={0.85}
            >
              <Text style={styles.handPrimaryBtnText}>
                Next Street ({STREETS[currentStreetIdx + 1]?.label})
              </Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.textDark} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.handPrimaryBtn, SHADOWS.card]}
              onPress={handleSaveShowdownHand}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-done" size={20} color={COLORS.textDark} style={{ marginRight: 6 }} />
              <Text style={styles.handPrimaryBtnText}>Save Hand</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* FOLD ASSESSMENT MODAL */}
        <Modal
          visible={foldModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFoldModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, SHADOWS.card]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="close" size={24} color={COLORS.danger} />
                </View>
                <Text style={styles.modalTitle}>Fold Assessment</Text>
                <Text style={styles.modalSubtitle}>
                  You committed {currencySymbol}{heroTotalInvestment.toFixed(2)} up to {STREETS[currentStreetIdx]?.label}.
                  Tag this fold for your behavioral analytics:
                </Text>
              </View>

              <View style={styles.foldOptionList}>
                <TouchableOpacity
                  style={[styles.foldOptionItem, { borderColor: COLORS.primaryGlow }]}
                  onPress={() => handleConfirmFold('bluffed')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.foldTagBadge, { backgroundColor: COLORS.primaryMuted }]}>
                    <Text style={[styles.foldTagBadgeText, { color: COLORS.primary }]}>BLUFFED</Text>
                  </View>
                  <Text style={styles.foldOptionLabel}>I Got Bluffed</Text>
                  <Text style={styles.foldOptionDesc}>
                    Opponent showed weak cards / I folded the winner.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.foldOptionItem, { borderColor: COLORS.cardBorder }]}
                  onPress={() => handleConfirmFold('good_fold')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.foldTagBadge, { backgroundColor: COLORS.backgroundSecondary }]}>
                    <Text style={styles.foldTagBadgeText}>GOOD FOLD</Text>
                  </View>
                  <Text style={styles.foldOptionLabel}>Good Discipline Fold</Text>
                  <Text style={styles.foldOptionDesc}>Opponent had the better hand.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.foldOptionItem, { borderColor: COLORS.cardBorder }]}
                  onPress={() => handleConfirmFold('no_show')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.foldTagBadge, { backgroundColor: COLORS.backgroundSecondary }]}>
                    <Text style={styles.foldTagBadgeText}>NO-SHOW</Text>
                  </View>
                  <Text style={styles.foldOptionLabel}>Mucked / Unknown</Text>
                  <Text style={styles.foldOptionDesc}>Cards were hidden.</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setFoldModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel (Keep Playing Hand)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* LOG OPPONENT RAISE MODAL */}
        <Modal
          visible={raiseModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRaiseModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, SHADOWS.card]}>
              <Text style={styles.modalTitle}>Log Table Bet / Raise</Text>
              <Text style={styles.modalSubtitle}>
                Add an opponent bet and the number of other callers to update the pot.
              </Text>

              <Text style={styles.label}>Raise Amount ({currencySymbol})</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 20"
                placeholderTextColor={COLORS.textMuted}
                value={raiseAmount}
                onChangeText={setRaiseAmount}
                autoFocus
              />

              <Text style={styles.label}>Other Opponents Who Called</Text>
              <View style={styles.stepperControl}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setCallersCount((c) => Math.max(0, c - 1))}
                >
                  <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{callersCount} Caller(s)</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setCallersCount((c) => Math.min(8, c + 1))}
                >
                  <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setRaiseModalVisible(false)}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={handleApplyTableRaise}
                >
                  <Text style={styles.modalPrimaryText}>Add to Pot</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* DEAD MONEY / FOLDED PLAYER MODAL */}
        <Modal
          visible={deadMoneyModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeadMoneyModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, SHADOWS.card]}>
              <Text style={styles.modalTitle}>Player Folded with Chips in Pot</Text>
              <Text style={styles.modalSubtitle}>
                If a player put money in (e.g. called a bet) then folded to a re-raise, enter their dead money to keep it in the pot.
              </Text>

              <Text style={styles.label}>Chips Contributed by Folded Player ({currencySymbol})</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 20"
                placeholderTextColor={COLORS.textMuted}
                value={deadMoneyAmount}
                onChangeText={setDeadMoneyAmount}
                autoFocus
              />

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setDeadMoneyModalVisible(false)}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={handleApplyDeadMoneyFold}
                >
                  <Text style={styles.modalPrimaryText}>Apply Dead Money</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ==========================================
  // VIEW 3: POKER SESSION DASHBOARD
  // ==========================================
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backBtn} onPress={handleDiscardPress}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <View style={styles.liveIndicatorDot} />
          <Text style={styles.navTitle}>Live Poker</Text>
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
        {/* Session Net Banner Card */}
        <View style={[styles.statsBox, SHADOWS.card]}>
          <View style={styles.blindsHeaderPill}>
            <Text style={styles.blindsHeaderText}>
              {hasBlinds
                ? `STAKES: ${currencySymbol}${smallBlind} / ${currencySymbol}${bigBlind}`
                : 'CASUAL / NO BLINDS'}
            </Text>
          </View>

          <Text style={styles.statsSubtext}>SESSION NET OUTCOME</Text>
          <Text
            style={[
              styles.netAmount,
              {
                color:
                  sessionTotalNet > 0
                    ? COLORS.success
                    : sessionTotalNet < 0
                    ? COLORS.danger
                    : COLORS.textPrimary,
              },
            ]}
          >
            {sessionTotalNet > 0 ? '+' : sessionTotalNet < 0 ? '-' : ''}
            {currencySymbol}
            {Math.abs(sessionTotalNet).toFixed(2)}
          </Text>

          {/* Metric Pills Row */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Hands</Text>
              <Text style={styles.statPillValue}>{totalHandsCount}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Wins</Text>
              <Text style={[styles.statPillValue, { color: COLORS.success }]}>{winsCount}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Losses</Text>
              <Text style={[styles.statPillValue, { color: COLORS.danger }]}>{lossesCount}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Folds</Text>
              <Text style={styles.statPillValue}>{foldsCount}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Win %</Text>
              <Text style={[styles.statPillValue, { color: COLORS.primary }]}>
                {winRatePercent}%
              </Text>
            </View>
          </View>

          {/* Fold Analytics Badge */}
          {foldsCount > 0 && (
            <View style={styles.foldStatsBadgeRow}>
              <View style={styles.foldStatMiniPill}>
                <Ionicons name="eye-outline" size={12} color={COLORS.primary} style={{ marginRight: 3 }} />
                <Text style={styles.foldStatMiniText}>Bluffed: {bluffsCount}</Text>
              </View>
              <View style={styles.foldStatMiniPill}>
                <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.success} style={{ marginRight: 3 }} />
                <Text style={styles.foldStatMiniText}>Good Folds: {goodFoldsCount}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Prominent CTA: Start Hand */}
        <TouchableOpacity
          style={[styles.submitButton, SHADOWS.card]}
          onPress={handleStartNewHand}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="cards-playing" size={22} color={COLORS.textDark} style={{ marginRight: 8 }} />
          <Text style={styles.submitText}>Deal / Start Hand #{totalHandsCount + 1}</Text>
        </TouchableOpacity>

        {/* Hands Logged in Current Session */}
        {sessionHands.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Hands in Current Session</Text>
            <Text style={styles.swipeHint}>Swipe a hand to delete • Tap to expand details</Text>

            {sessionHands.map((h, idx) => {
              const isExpanded = expandedHandId === h.id;
              const isWin = h.outcome === 'win';
              const isFold = h.outcome === 'fold';
              const isSplit = h.outcome === 'split';

              return (
                <SwipeableRow
                  key={h.id}
                  onDelete={() => removeHandFromActiveSession(h.id)}
                  confirmTitle="Delete this hand?"
                  confirmMessage="This hand record will be removed from this session."
                >
                  <TouchableOpacity
                    style={[styles.historyCard, SHADOWS.card]}
                    activeOpacity={0.8}
                    onPress={() => setExpandedHandId((prev) => (prev === h.id ? null : h.id))}
                  >
                    <View style={styles.historyCardHeader}>
                      <View style={styles.historyCardMeta}>
                        <View style={styles.historyBadgeRow}>
                          <Text style={styles.historyHandNumber}>Hand #{sessionHands.length - idx}</Text>
                          {h.position && h.position !== 'None' && (
                            <View style={styles.historyPosBadge}>
                              <Text style={styles.historyPosText}>{h.position}</Text>
                            </View>
                          )}
                          {isFold && h.foldReason === 'bluffed' && (
                            <View style={[styles.historyPosBadge, { backgroundColor: COLORS.primaryMuted }]}>
                              <Text style={[styles.historyPosText, { color: COLORS.primary }]}>BLUFFED</Text>
                            </View>
                          )}
                          {isFold && h.foldReason === 'good_fold' && (
                            <View style={[styles.historyPosBadge, { backgroundColor: COLORS.backgroundSecondary }]}>
                              <Text style={styles.historyPosText}>GOOD FOLD</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.historySubtitle}>
                          Bet: {currencySymbol}{h.heroInvestment || 0} • Pot: {currencySymbol}{h.pot || 0}
                        </Text>
                      </View>

                      <View style={styles.historyNetContainer}>
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
                          {h.netChange > 0 ? '+' : h.netChange < 0 ? '-' : ''}
                          {currencySymbol}
                          {Math.abs(h.netChange).toFixed(2)}
                        </Text>
                        <Text style={styles.historyOutcomeLabel}>
                          {isWin ? 'WON' : isFold ? `FOLD (${h.streetFolded})` : isSplit ? 'SPLIT' : 'LOST'}
                        </Text>
                      </View>
                    </View>

                    {/* Expanded Street Breakdown */}
                    {isExpanded && h.streets && (
                      <View style={styles.expandedBreakdown}>
                        <View style={styles.expandedDivider} />
                        <Text style={styles.expandedBreakdownTitle}>Street Investments:</Text>
                        <View style={styles.streetGrid}>
                          <Text style={styles.streetGridItem}>Pre-Flop: {currencySymbol}{h.streets.preflop || 0}</Text>
                          <Text style={styles.streetGridItem}>Flop: {currencySymbol}{h.streets.flop || 0}</Text>
                          <Text style={styles.streetGridItem}>Turn: {currencySymbol}{h.streets.turn || 0}</Text>
                          <Text style={styles.streetGridItem}>River: {currencySymbol}{h.streets.river || 0}</Text>
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
    borderColor: COLORS.dangerBorder,
  },
  headerEndButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  foldHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  foldHeaderText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 14,
    lineHeight: 16,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.backgroundSecondary,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontWeight: '700',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  submitText: {
    color: COLORS.textDark,
    fontWeight: '800',
    fontSize: 15,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  presetButtonActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  presetTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  customBlindRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  chipConfigGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipConfigBox: {
    width: '30%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  chipConfigLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  chipInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipCurrencyPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginRight: 2,
  },
  chipConfigInput: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    minWidth: 36,
  },
  stepperBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  stepTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  stepTabActive: {
    backgroundColor: COLORS.primaryMuted,
  },
  stepTabCompleted: {
    backgroundColor: COLORS.backgroundSecondary,
  },
  stepTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  stepTabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  stepTabTextCompleted: {
    color: COLORS.textSecondary,
  },
  statsBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  blindsHeaderPill: {
    alignSelf: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 8,
  },
  blindsHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  statsSubtext: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
    textAlign: 'center',
  },
  netAmount: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  potHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  potValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInvestmentBadge: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'flex-end',
  },
  heroInvestmentLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  heroInvestmentValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  directPotEditBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  directPotEditHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  directPotInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: 10,
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activePlayersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  activePlayersLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  stepperControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  positionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  positionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  positionBtnActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  positionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  positionTextActive: {
    color: COLORS.primary,
  },
  streetBetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.backgroundSecondary,
  },
  clearBtnText: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: '700',
  },
  heroBetDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 12,
  },
  heroBetSymbol: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    marginRight: 4,
  },
  heroBetInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  heroBetPhaseTag: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  chipRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    width: '31%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chipInnerCircle: {
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  tableActionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  tableActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  tableActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  deadMoneyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    gap: 6,
  },
  deadMoneyText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  showdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  showdownOptionBtn: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  showdownWinActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  showdownSplitActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  showdownLossActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  showdownOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  showdownOptionTitleActive: {
    color: COLORS.textDark,
  },
  showdownOptionSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  showdownOptionSubActive: {
    color: COLORS.textDark,
  },
  splitWayRow: {
    marginBottom: 16,
  },
  splitWayBtnGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  splitWayPill: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  splitWayPillActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  splitWayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  splitWayPillTextActive: {
    color: COLORS.primary,
  },
  showdownSummaryBox: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  showdownSummaryTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },
  showdownNetNumber: {
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 4,
  },
  showdownSummarySub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  handBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    gap: 10,
  },
  handNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  handNavBtnDisabled: {
    opacity: 0.3,
  },
  handNavBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: 4,
  },
  handPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  handPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  foldOptionList: {
    gap: 10,
    marginBottom: 16,
  },
  foldOptionItem: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  foldTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  foldTagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  foldOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  foldOptionDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalPrimaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    marginTop: 8,
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
    fontSize: 9,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statPillValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  foldStatsBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  foldStatMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  foldStatMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  historySection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  swipeHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 10,
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 10,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCardMeta: {
    flex: 1,
  },
  historyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  historyHandNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  historyPosBadge: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  historyPosText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  historySubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  historyNetContainer: {
    alignItems: 'flex-end',
  },
  historyNet: {
    fontSize: 15,
    fontWeight: '900',
  },
  historyOutcomeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  expandedBreakdown: {
    marginTop: 10,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginBottom: 8,
  },
  expandedBreakdownTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  streetGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streetGridItem: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});