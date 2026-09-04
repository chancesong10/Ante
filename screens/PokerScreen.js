import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';
import { useGameSession } from '../context/SessionContext';
import { useSessionEndFx } from '../context/SessionEndFxContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import SwipeableRow from '../components/SwipeableRow';
import ConfirmModal from '../components/ConfirmModal';
import GuestModeBanner from '../components/GuestModeBanner';
import LivePulseDot from '../components/LivePulseDot';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const STREETS = [
  { key: 'preflop', label: 'Pre-Flop', short: 'Pre' },
  { key: 'flop', label: 'Flop', short: 'Flop' },
  { key: 'turn', label: 'Turn (4th)', short: 'Turn' },
  { key: 'river', label: 'River (5th)', short: 'River' },
  { key: 'showdown', label: 'Showdown', short: 'Result' },
];

const BLIND_MODES = [
  { key: 'none', label: 'No Blinds' },
  { key: 'big', label: 'Big Blind Only' },
  { key: 'both', label: 'Small + Big Blind' },
];

export default function PokerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    currencySymbol = '$',
    quickChipPresets,
    setQuickChipPreset,
    isLoaded: prefsLoaded,
  } = usePreferences();
  const { user } = useAuth();
  const {
    activeSession,
    startSession,
    updateActiveSessionMetadata,
    logHandToActiveSession,
    removeHandFromActiveSession,
    endActiveSession,
    discardActiveSession,
  } = useGameSession("Poker");
  const { endSessionWithFx } = useSessionEndFx();

  // Screen View Mode: 'setup' | 'dashboard' | 'hand'
  const [viewMode, setViewMode] = useState('setup');

  // --- Session Configuration State ---
  const [setupStep, setSetupStep] = useState('players'); // 'players' | 'blinds'
  const [playerCount, setPlayerCount] = useState('');
  const [smallBlind, setSmallBlind] = useState('1');
  const [bigBlind, setBigBlind] = useState('2');
  const [blindMode, setBlindMode] = useState('both'); // 'none' | 'big' | 'both'
  const [chipDenominations, setChipDenominations] = useState(['1', '5', '25', '50', '100', '500']);
  // Seeds the setup form from the player's saved poker chip preset once
  // preferences have hydrated, unless an in-progress session already carries
  // its own denominations.
  const chipsHydratedRef = useRef(false);
  const [playerNames, setPlayerNames] = useState({}); // { '1': 'Alice', '2': 'Bob', ... }

  const hasBlinds = blindMode !== 'none';

  // Ensure active session is initialized
  useEffect(() => {
    if (!activeSession) {
      startSession('Poker');
    } else if (activeSession.gameType === 'Poker' && activeSession.chipDenominations) {
      setSmallBlind(String(activeSession.smallBlind !== undefined && activeSession.smallBlind !== null ? activeSession.smallBlind : '1'));
      setBigBlind(String(activeSession.bigBlind !== undefined && activeSession.bigBlind !== null ? activeSession.bigBlind : '2'));
      if (activeSession.blindMode) {
        setBlindMode(activeSession.blindMode);
      } else {
        setBlindMode(activeSession.smallBlind ? 'both' : activeSession.bigBlind ? 'big' : 'none');
      }
      if (activeSession.playerCount) {
        setPlayerCount(String(activeSession.playerCount));
      }
      if (Array.isArray(activeSession.chipDenominations) && activeSession.chipDenominations.length > 0) {
        setChipDenominations(activeSession.chipDenominations.map(String));
      }
      if (activeSession.playerNames && typeof activeSession.playerNames === 'object') {
        setPlayerNames(activeSession.playerNames);
      }
      setViewMode('dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill the setup form with the last poker chip set the player saved, so a
  // new session with the same denominations doesn't have to be re-typed.
  useEffect(() => {
    if (chipsHydratedRef.current || !prefsLoaded) return;
    chipsHydratedRef.current = true;

    const restoredFromSession =
      activeSession?.gameType === 'Poker' &&
      Array.isArray(activeSession.chipDenominations) &&
      activeSession.chipDenominations.length > 0;
    if (restoredFromSession) return;

    const preset = quickChipPresets?.poker;
    if (Array.isArray(preset) && preset.length > 0) {
      setChipDenominations(preset.map(String));
    }
  }, [prefsLoaded, quickChipPresets, activeSession]);

  // --- Active Hand Tracking State ---
  const [currentStreetIdx, setCurrentStreetIdx] = useState(0);

  // Street by street contributions (hero)
  const [streetBets, setStreetBets] = useState({
    preflop: 0,
    flop: 0,
    turn: 0,
    river: 0,
  });

  // Other players at the table: n-1 seats, each tracked street-by-street
  const [opponents, setOpponents] = useState([]);

  // Early Fold Modal & Assessment
  const [foldModalVisible, setFoldModalVisible] = useState(false);

  // Tracks that the user dismissed the "everyone folded" win prompt, so it
  // doesn't re-fire until someone is back in the hand (undo a misclicked fold).
  const [foldWinDismissed, setFoldWinDismissed] = useState(false);

  // Custom Alert / Confirm Modal (replaces native Alert.alert popups)
  const [alertModal, setAlertModal] = useState(null);
  const closeAlertModal = () => setAlertModal(null);

  // Showdown State
  const [showdownResult, setShowdownResult] = useState('win'); // 'win' | 'split' | 'loss'
  const [splitWay, setSplitWay] = useState(2); // 2, 3, 4

  // Expanded Hand Row in Dashboard
  const [expandedHandId, setExpandedHandId] = useState(null);

  // Swipe detection ref
  const touchStartX = useRef(0);

  // Blind values, used as quick-chip shortcuts on every player's bet card
  const sbVal = activeSession && activeSession.smallBlind !== undefined ? activeSession.smallBlind : (hasBlinds ? parseFloat(smallBlind) || 0 : 0);
  const bbVal = activeSession && activeSession.bigBlind !== undefined ? activeSession.bigBlind : (hasBlinds ? parseFloat(bigBlind) || 0 : 0);

  // Player count / naming
  const seededPlayerCount = activeSession && activeSession.playerCount ? activeSession.playerCount : (parseInt(playerCount, 10) || 6);
  const numOpponents = Math.max(0, seededPlayerCount - 1);
  const getPlayerLabel = (id) => {
    const name = playerNames[id];
    return name && name.trim() ? name.trim() : `Player ${id}`;
  };

  // Calculated totals
  const currentStreetKey = STREETS[currentStreetIdx]?.key || 'preflop';
  const currentHeroBet = streetBets[currentStreetKey] || 0;
  const heroTotalInvestment =
    (streetBets.preflop || 0) +
    (streetBets.flop || 0) +
    (streetBets.turn || 0) +
    (streetBets.river || 0);

  const opponentsTotalInvestment = opponents.reduce(
    (sum, o) =>
      sum +
      (o.streetBets.preflop || 0) +
      (o.streetBets.flop || 0) +
      (o.streetBets.turn || 0) +
      (o.streetBets.river || 0),
    0
  );

  const effectiveTotalPot = heroTotalInvestment + opponentsTotalInvestment;

  const currentStreetMaxBet = Math.max(
    currentHeroBet,
    0,
    ...opponents.filter((o) => !o.folded).map((o) => o.streetBets[currentStreetKey] || 0)
  );

  // Hero is the last player standing once every seated opponent has folded.
  const activeOpponentCount = opponents.filter((o) => !o.folded).length;
  const everyoneFolded = opponents.length > 0 && activeOpponentCount === 0;
  const foldWinNet = effectiveTotalPot - heroTotalInvestment;

  // --- Handlers: Session Setup ---
  const handleBlindModeSelect = (mode) => {
    setBlindMode(mode);
    if (mode === 'none') {
      setSmallBlind('0');
      setBigBlind('0');
    } else if (mode === 'big') {
      setSmallBlind('0');
    }
  };

  const handleConfirmPlayerCount = () => {
    const count = parseInt(playerCount, 10);
    if (isNaN(count) || count < 2 || count > 10) {
      setAlertModal({
        variant: 'warning',
        title: 'Invalid Player Count',
        message: 'Enter a number of players between 2 and 10.',
        confirmText: 'Got It',
        showCancel: false,
        onConfirm: closeAlertModal,
      });
      return;
    }
    setSetupStep('blinds');
  };

  const handleFinishSetup = () => {
    const sb = blindMode === 'both' ? parseFloat(smallBlind) || 0 : 0;
    const bb = blindMode !== 'none' ? parseFloat(bigBlind) || 0 : 0;
    const validChips = chipDenominations.map((c) => parseFloat(c)).filter((n) => !isNaN(n) && n > 0);

    const chips = validChips.length > 0 ? validChips : [1, 5, 25, 50, 100, 500];
    const count = parseInt(playerCount, 10) || 6;

    updateActiveSessionMetadata({
      playerCount: count,
      smallBlind: sb,
      bigBlind: bb,
      blindMode,
      chipDenominations: chips,
    });

    // Remember this chip set as the default for the next poker session.
    setQuickChipPreset?.('poker', chips.map(String));

    setViewMode('dashboard');
  };

  // --- Handlers: Start New Hand ---
  const handleStartNewHand = () => {
    setCurrentStreetIdx(0);
    setStreetBets({ preflop: 0, flop: 0, turn: 0, river: 0 });
    setOpponents(
      Array.from({ length: numOpponents }, (_, i) => ({
        id: i + 1,
        streetBets: { preflop: 0, flop: 0, turn: 0, river: 0 },
        folded: false,
        foldedStreet: null,
      }))
    );
    setShowdownResult('win');
    setSplitWay(2);
    setFoldWinDismissed(false);

    setViewMode('hand');
  };

  // --- Handlers: Incremental Quick Chips for Hero Bet ---
  const handleHeroChipPress = (chipValue) => {
    hapticLight();
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
    const val = Math.max(0, parseFloat(text) || 0);
    setStreetBets((prev) => ({
      ...prev,
      [currentStreetKey]: val,
    }));
  };

  const handleHeroCall = () => {
    hapticLight();
    setStreetBets((prev) => ({
      ...prev,
      [currentStreetKey]: currentStreetMaxBet,
    }));
  };

  // --- Handlers: Other Players' Bets & Folds ---
  const handleOpponentChipPress = (id, chipValue) => {
    hapticLight();
    const val = parseFloat(chipValue) || 0;
    setOpponents((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, streetBets: { ...o.streetBets, [currentStreetKey]: (o.streetBets[currentStreetKey] || 0) + val } }
          : o
      )
    );
  };

  const handleOpponentClearBet = (id) => {
    setOpponents((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, streetBets: { ...o.streetBets, [currentStreetKey]: 0 } } : o
      )
    );
  };

  const handleOpponentDirectBetChange = (id, text) => {
    const val = Math.max(0, parseFloat(text) || 0);
    setOpponents((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, streetBets: { ...o.streetBets, [currentStreetKey]: val } } : o
      )
    );
  };

  const handleToggleOpponentFold = (id) => {
    setOpponents((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              folded: !o.folded,
              foldedStreet: !o.folded ? STREETS[currentStreetIdx]?.label : null,
            }
          : o
      )
    );
  };

  const handleOpponentCall = (id) => {
    hapticLight();
    setOpponents((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, streetBets: { ...o.streetBets, [currentStreetKey]: currentStreetMaxBet } }
          : o
      )
    );
  };

  // --- Handlers: Player Names ---
  const handlePlayerNameChange = (id, name) => {
    const updated = { ...playerNames, [id]: name };
    setPlayerNames(updated);
    updateActiveSessionMetadata({ playerNames: updated });
  };

  // --- Handlers: Street Betting Validation & Advancement ---
  const getStreetMismatch = () => {
    const liveBets = [{ label: 'You', amount: currentHeroBet }];
    opponents.forEach((o) => {
      if (!o.folded) {
        liveBets.push({ label: getPlayerLabel(o.id), amount: o.streetBets[currentStreetKey] || 0 });
      }
    });
    if (liveBets.length <= 1) return null;
    const first = liveBets[0].amount;
    return liveBets.some((b) => b.amount !== first) ? liveBets : null;
  };

  const handleAdvanceStreet = (targetIdx) => {
    if (targetIdx > currentStreetIdx) {
      const mismatch = getStreetMismatch();
      if (mismatch) {
        setAlertModal({
          variant: 'warning',
          icon: 'git-compare-outline',
          title: "Bets Don't Match",
          message: `Everyone still in the hand needs to match the same bet on ${STREETS[currentStreetIdx]?.label} before moving on. Update their bet, use Call, or fold them.`,
          children: (
            <View style={styles.mismatchList}>
              {mismatch.map((b, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.mismatchRow,
                    idx === mismatch.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.mismatchLabel}>{b.label}</Text>
                  <Text style={styles.mismatchAmount}>
                    {currencySymbol}{b.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          ),
          confirmText: 'Got It',
          showCancel: false,
          onConfirm: closeAlertModal,
        });
        return;
      }
    }
    setCurrentStreetIdx(targetIdx);
  };

  // --- Handlers: Early Fold ---
  const handleConfirmFold = (foldReason) => {
    setFoldModalVisible(false);

    const handRecord = {
      id: Date.now(),
      gameType: 'Poker',
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

  // --- Handlers: Win Because Everyone Folded ---
  const handleWinByFold = () => {
    closeAlertModal();

    const handRecord = {
      id: Date.now(),
      gameType: 'Poker',
      outcome: 'win',
      wonBy: 'fold', // uncontested — table folded to the hero
      splitCount: 1,
      streetFolded: STREETS[currentStreetIdx]?.label || 'Pre-Flop',
      heroInvestment: heroTotalInvestment,
      pot: effectiveTotalPot,
      netChange: foldWinNet,
      streets: { ...streetBets },
      timestamp: Date.now(),
    };

    logHandToActiveSession(handRecord);
    setViewMode('dashboard');
  };

  // When the table folds around to the hero mid-hand, offer to end the hand and
  // take the pot. "Go Back" just dismisses the prompt — each opponent card keeps
  // its own "Undo Fold" button, and the prompt re-arms once anyone is back in.
  useEffect(() => {
    if (viewMode !== 'hand') return;

    if (everyoneFolded && !foldWinDismissed) {
      setAlertModal({
        variant: 'primary',
        icon: 'trophy-outline',
        title: 'Everyone Folded',
        message: `The table folded to you. Take the ${currencySymbol}${effectiveTotalPot.toFixed(2)} pot for a ${foldWinNet >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(foldWinNet).toFixed(2)} net. Folded someone by mistake? Go back and hit "Undo Fold" on their card.`,
        confirmText: 'Take the Pot',
        cancelText: 'Go Back',
        onConfirm: handleWinByFold,
        onCancel: () => {
          closeAlertModal();
          setFoldWinDismissed(true);
        },
      });
    } else if (!everyoneFolded && foldWinDismissed) {
      setFoldWinDismissed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyoneFolded, viewMode]);

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
    hapticSuccess();
    const hands = activeSession?.hands || [];
    if (hands.length === 0) {
      discardActiveSession();
      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }

    endSessionWithFx({
      net: sessionTotalNet,
      gameType: 'Poker',
      onCommit: () => endActiveSession(),
    });
  };

  // Backing out of the dashboard just leaves the session live (like Blackjack
  // and Sports Betting) — the Home screen shows a "Resume Session" card for it,
  // and the header "End Session" button is the deliberate way to close it out.
  const handleLeaveSession = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  // Mirrors whichever on-screen back button is showing for the current
  // viewMode/setupStep, so the Android hardware back button behaves the same
  // as the on-screen back arrow. Registered via useFocusEffect (not useEffect)
  // so the listener is torn down whenever this screen is blurred — otherwise a
  // paused session left mounted in the stack keeps intercepting the back
  // gesture from other screens (Analytics, Insights) and pops its own modal.
  useFocusEffect(
    useCallback(() => {
      const handleHardwareBack = () => {
        if (viewMode === 'hand') {
          setAlertModal({
            variant: 'danger',
            icon: 'close-circle-outline',
            title: 'Cancel This Hand?',
            message: 'Progress for this hand will be lost.',
            confirmText: 'Cancel Hand',
            cancelText: 'Keep Tracking',
            onConfirm: () => {
              closeAlertModal();
              setViewMode('dashboard');
            },
            onCancel: closeAlertModal,
          });
          return true;
        }
        if (viewMode === 'setup' && setupStep === 'blinds') {
          setSetupStep('players');
          return true;
        }
        if (viewMode === 'setup') {
          navigation.navigate('MainTabs', { screen: 'Home' });
          return true;
        }
        handleLeaveSession();
        return true;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, setupStep])
  );

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
  if (viewMode === 'setup' && setupStep === 'players') {
    const count = parseInt(playerCount, 10);
    const isValidCount = !isNaN(count) && count >= 2 && count <= 10;

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
            <Text style={styles.sectionHeaderTitle}>How Many Players?</Text>
            <Text style={styles.cardSubtitle}>
              Enter the total number of players at the table, including yourself.
            </Text>

            <Text style={styles.label}>Players at the Table</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="e.g. 6"
              placeholderTextColor={COLORS.textMuted}
              value={playerCount}
              onChangeText={setPlayerCount}
              autoFocus
              maxLength={2}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              SHADOWS.card,
              !isValidCount && styles.submitButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={!isValidCount}
            onPress={handleConfirmPlayerCount}
          >
            <Ionicons name="arrow-forward-circle" size={20} color={COLORS.textDark} style={{ marginRight: 8 }} />
            <Text style={styles.submitText}>Continue to Blinds</Text>
          </TouchableOpacity>
        </ScrollView>

        <ConfirmModal visible={!!alertModal} {...alertModal} />
      </View>
    );
  }

  if (viewMode === 'setup' && setupStep === 'blinds') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setSetupStep('players')}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
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
            <Text style={styles.sectionHeaderTitle}>Table Blinds</Text>
            <Text style={styles.cardSubtitle}>
              Choose which blinds are in play, then type in your own stakes.
            </Text>

            {/* Blind Mode Selector */}
            <View style={styles.presetRow}>
              {BLIND_MODES.map((mode) => {
                const isSelected = blindMode === mode.key;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    style={[styles.presetButton, isSelected && styles.presetButtonActive]}
                    onPress={() => handleBlindModeSelect(mode.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {blindMode !== 'none' && (
              <View style={styles.customBlindRow}>
                {blindMode === 'both' && (
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
                )}
                <View style={{ flex: 1, marginLeft: blindMode === 'both' ? 8 : 0 }}>
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
    const isShowdown = currentStreetIdx === 4;

    const renderBetChips = (currentBet, onChipPress, onCall) => {
      const canCall = currentStreetMaxBet > currentBet;

      return (
        <>
          <View style={styles.blindCallRow}>
            {sbVal > 0 && (
              <TouchableOpacity
                style={[styles.blindCallBtn, styles.blindCallBtnBlind]}
                onPress={() => onChipPress(sbVal)}
                activeOpacity={0.75}
              >
                <Text style={styles.blindCallBtnBlindText}>
                  SB +{currencySymbol}{sbVal}
                </Text>
              </TouchableOpacity>
            )}
            {bbVal > 0 && (
              <TouchableOpacity
                style={[styles.blindCallBtn, styles.blindCallBtnBlind]}
                onPress={() => onChipPress(bbVal)}
                activeOpacity={0.75}
              >
                <Text style={styles.blindCallBtnBlindText}>
                  BB +{currencySymbol}{bbVal}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.blindCallBtn,
                canCall ? styles.blindCallBtnCall : styles.blindCallBtnCallDisabled,
              ]}
              onPress={canCall ? onCall : undefined}
              disabled={!canCall}
              activeOpacity={0.75}
            >
              <Text
                style={
                  canCall ? styles.blindCallBtnCallText : styles.blindCallBtnCallTextDisabled
                }
              >
                Call {currencySymbol}{currentStreetMaxBet}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chipGrid}>
            {chipDenominations.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.chipButton}
                onPress={() => onChipPress(chip)}
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
        </>
      );
    };

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
              setAlertModal({
                variant: 'danger',
                icon: 'close-circle-outline',
                title: 'Cancel This Hand?',
                message: 'Progress for this hand will be lost.',
                confirmText: 'Cancel Hand',
                cancelText: 'Keep Tracking',
                onConfirm: () => {
                  closeAlertModal();
                  setViewMode('dashboard');
                },
                onCancel: closeAlertModal,
              });
            }}
          >
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <LivePulseDot size={8} color={COLORS.danger} />
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
                onPress={() => handleAdvanceStreet(idx)}
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
          {/* NON-SHOWDOWN STREETS (Pre-Flop, Flop, Turn, River) */}
          {!isShowdown ? (
            <>
              {/* Your Bet for Current Street */}
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
                {renderBetChips(currentHeroBet, handleHeroChipPress, handleHeroCall)}
              </View>

              {/* Other Players' Bets for Current Street */}
              {opponents.map((opp) => {
                const oppBet = opp.streetBets[currentStreetKey] || 0;
                const oppTotalContributed =
                  (opp.streetBets.preflop || 0) +
                  (opp.streetBets.flop || 0) +
                  (opp.streetBets.turn || 0) +
                  (opp.streetBets.river || 0);

                return (
                  <View
                    key={opp.id}
                    style={[styles.card, SHADOWS.card, opp.folded && styles.playerCardFolded]}
                  >
                    <View style={styles.streetBetHeader}>
                      <Text style={styles.sectionHeaderTitle}>{getPlayerLabel(opp.id)}</Text>
                      {opp.folded ? (
                        <View style={styles.foldedBadge}>
                          <Text style={styles.foldedBadgeText}>FOLDED</Text>
                        </View>
                      ) : (
                        oppBet > 0 && (
                          <TouchableOpacity
                            onPress={() => handleOpponentClearBet(opp.id)}
                            style={styles.clearBtn}
                          >
                            <Ionicons name="refresh" size={14} color={COLORS.danger} style={{ marginRight: 3 }} />
                            <Text style={styles.clearBtnText}>Reset $0</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>

                    {opp.folded ? (
                      <Text style={styles.foldedContributionText}>
                        Folded on {opp.foldedStreet || 'this street'} • Contributed {currencySymbol}
                        {oppTotalContributed.toFixed(2)} total
                      </Text>
                    ) : (
                      <>
                        <View style={styles.heroBetDisplayRow}>
                          <Text style={styles.heroBetSymbol}>{currencySymbol}</Text>
                          <TextInput
                            style={styles.heroBetInput}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={COLORS.textMuted}
                            value={oppBet > 0 ? String(oppBet) : ''}
                            onChangeText={(text) => handleOpponentDirectBetChange(opp.id, text)}
                          />
                          <Text style={styles.heroBetPhaseTag}>
                            {oppBet === 0 ? 'Check / $0' : 'Committed'}
                          </Text>
                        </View>

                        <Text style={styles.chipRowLabel}>Tap Chips to Increment Bet:</Text>
                        {renderBetChips(
                          oppBet,
                          (val) => handleOpponentChipPress(opp.id, val),
                          () => handleOpponentCall(opp.id)
                        )}
                      </>
                    )}

                    <TouchableOpacity
                      style={[styles.foldToggleBtn, opp.folded && styles.foldToggleBtnActive]}
                      onPress={() => handleToggleOpponentFold(opp.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={opp.folded ? 'refresh' : 'close-circle-outline'}
                        size={16}
                        color={opp.folded ? COLORS.textSecondary : COLORS.danger}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.foldToggleBtnText,
                          opp.folded && styles.foldToggleBtnTextActive,
                        ]}
                      >
                        {opp.folded ? 'Undo Fold' : 'Fold This Player'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
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

          {everyoneFolded ? (
            <TouchableOpacity
              style={[styles.handPrimaryBtn, SHADOWS.card]}
              onPress={handleWinByFold}
              activeOpacity={0.85}
            >
              <Ionicons name="trophy" size={18} color={COLORS.textDark} style={{ marginRight: 6 }} />
              <Text style={styles.handPrimaryBtnText}>
                Take Pot ({foldWinNet >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(foldWinNet).toFixed(2)})
              </Text>
            </TouchableOpacity>
          ) : !isShowdown ? (
            <TouchableOpacity
              style={[styles.handPrimaryBtn, SHADOWS.card]}
              onPress={() => handleAdvanceStreet(Math.min(STREETS.length - 1, currentStreetIdx + 1))}
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
                  style={styles.foldOptionItem}
                  onPress={() => handleConfirmFold('bluffed')}
                  activeOpacity={0.8}
                >
                  <View style={styles.foldTagBadge}>
                    <Text style={styles.foldTagBadgeText}>BLUFFED</Text>
                  </View>
                  <Text style={styles.foldOptionLabel}>I Got Bluffed</Text>
                  <Text style={styles.foldOptionDesc}>
                    Opponent showed weak cards / I folded the winner.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.foldOptionItem}
                  onPress={() => handleConfirmFold('good_fold')}
                  activeOpacity={0.8}
                >
                  <View style={styles.foldTagBadge}>
                    <Text style={styles.foldTagBadgeText}>GOOD FOLD</Text>
                  </View>
                  <Text style={styles.foldOptionLabel}>Good Discipline Fold</Text>
                  <Text style={styles.foldOptionDesc}>Opponent had the better hand.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.foldOptionItem}
                  onPress={() => handleConfirmFold('no_show')}
                  activeOpacity={0.8}
                >
                  <View style={styles.foldTagBadge}>
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

        <ConfirmModal visible={!!alertModal} {...alertModal} />
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
        <TouchableOpacity style={styles.backBtn} onPress={handleLeaveSession}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <LivePulseDot size={8} color={COLORS.danger} />
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
        {!user && <GuestModeBanner />}

        {/* Session Net Banner Card */}
        <View style={[styles.statsBox, SHADOWS.card]}>
          <View style={styles.blindsHeaderPill}>
            <Text style={styles.blindsHeaderText}>
              {blindMode === 'both'
                ? `STAKES: ${currencySymbol}${smallBlind} / ${currencySymbol}${bigBlind}`
                : blindMode === 'big'
                ? `STAKES: BB ${currencySymbol}${bigBlind}`
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

        {/* Player Names */}
        {numOpponents > 0 && (
          <View style={[styles.card, SHADOWS.card]}>
            <Text style={styles.sectionHeaderTitle}>Name Your Players</Text>
            <Text style={styles.cardSubtitle}>
              Optional — give the other seats real names instead of "Player 1, 2, 3…"
            </Text>

            <View style={styles.playerNameList}>
              {Array.from({ length: numOpponents }, (_, i) => i + 1).map((id) => (
                <View key={id} style={styles.playerNameRow}>
                  <Text style={styles.playerNameTag}>P{id}</Text>
                  <TextInput
                    style={styles.playerNameInput}
                    placeholder={`Player ${id}`}
                    placeholderTextColor={COLORS.textMuted}
                    value={playerNames[id] || ''}
                    onChangeText={(text) => handlePlayerNameChange(id, text)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

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

      <ConfirmModal visible={!!alertModal} {...alertModal} />
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
    fontWeight: '700',
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
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: COLORS.textDark,
    fontWeight: '700',
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
  playerNameList: {
    gap: 8,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerNameTag: {
    width: 30,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  playerNameInput: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    color: COLORS.textPrimary,
    fontSize: 14,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
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
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 4,
  },
  heroBetInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
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
  blindCallRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  blindCallBtn: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  blindCallBtnBlind: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  blindCallBtnBlindText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  blindCallBtnCall: {
    backgroundColor: COLORS.successMuted,
    borderColor: COLORS.success,
  },
  blindCallBtnCallText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.success,
  },
  blindCallBtnCallDisabled: {
    backgroundColor: COLORS.backgroundSecondary,
    borderColor: COLORS.cardBorder,
    opacity: 0.5,
  },
  blindCallBtnCallTextDisabled: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chipInnerCircle: {
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  playerCardFolded: {
    opacity: 0.6,
  },
  foldedBadge: {
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  foldedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
    letterSpacing: 0.5,
  },
  foldedContributionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  mismatchList: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  mismatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  mismatchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  mismatchAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  foldToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  foldToggleBtnActive: {
    borderColor: COLORS.cardBorder,
  },
  foldToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  foldToggleBtnTextActive: {
    color: COLORS.textSecondary,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    borderColor: COLORS.cardBorderHighlight,
  },
  foldTagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: COLORS.primaryMuted,
  },
  foldTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
