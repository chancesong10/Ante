import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  BackHandler,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { styles } from './pokerScreenStyles';
import { PokerSetupPlayers, PokerSetupBlinds } from './PokerSetup';
import { screenStyles } from '../constants/screenStyles';
import { moderateScale } from '../constants/layout';
import { useGameSession } from '../context/SessionContext';
import { useSessionEndFx } from '../context/SessionEndFxContext';
import { usePreferences, DEFAULT_QUICK_CHIP_PRESETS } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import SwipeableRow from '../components/SwipeableRow';
import ConfirmModal from '../components/ConfirmModal';
import GuestModeBanner from '../components/GuestModeBanner';
import LivePulseDot from '../components/LivePulseDot';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { formatAmount, formatMoney, formatNumber, netTone } from '../utils/format';
import {
  heroInvestment,
  derivePot,
  currentStreetMaxBet as maxBetOnStreet,
  streetMismatch,
  everyoneFolded as allOpponentsFolded,
  foldWinNet as netFromFoldWin,
  buildHandRecord,
} from '../utils/pokerHand';
import TrackerGuide from '../components/TrackerGuide';

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
    privacyMode = false,
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
  const [chipDenominations, setChipDenominations] = useState(DEFAULT_QUICK_CHIP_PRESETS.poker);
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

  // Calculated totals. The arithmetic lives in utils/pokerHand so it can be
  // tested — see utils/__tests__/pokerHand.test.js for dead money, chops, and
  // the float-drift case.
  const currentStreetKey = STREETS[currentStreetIdx]?.key || 'preflop';
  const currentHeroBet = streetBets[currentStreetKey] || 0;
  const heroTotalInvestment = heroInvestment(streetBets);
  const effectiveTotalPot = derivePot(streetBets, opponents);
  const currentStreetMaxBet = maxBetOnStreet(currentStreetKey, currentHeroBet, opponents);
  const everyoneFolded = allOpponentsFolded(opponents);
  const foldWinNet = netFromFoldWin(effectiveTotalPot, heroTotalInvestment);

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
  const getStreetMismatch = () =>
    streetMismatch(currentStreetKey, currentHeroBet, opponents, getPlayerLabel);

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
                    {currencySymbol}{formatNumber(b.amount)}
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

    const handRecord = buildHandRecord({
      id: Crypto.randomUUID(),
      timestamp: Date.now(),
      outcome: 'fold',
      streetBets,
      opponents,
      foldReason, // 'bluffed' | 'good_fold' | 'no_show'
      streetFolded: STREETS[currentStreetIdx]?.label || 'Pre-Flop',
    });

    logHandToActiveSession(handRecord);
    setViewMode('dashboard');
  };

  // --- Handlers: Win Because Everyone Folded ---
  const handleWinByFold = () => {
    closeAlertModal();

    const handRecord = buildHandRecord({
      id: Crypto.randomUUID(),
      timestamp: Date.now(),
      outcome: 'win',
      streetBets,
      opponents,
      wonBy: 'fold', // uncontested — table folded to the hero
      streetFolded: STREETS[currentStreetIdx]?.label || 'Pre-Flop',
    });

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
        message: `The table folded to you. Take the ${currencySymbol}${formatNumber(effectiveTotalPot)} pot for a ${foldWinNet >= 0 ? '+' : '-'}${currencySymbol}${formatNumber(Math.abs(foldWinNet))} net. Folded someone by mistake? Go back and hit "Undo Fold" on their card.`,
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
    const handRecord = buildHandRecord({
      id: Crypto.randomUUID(),
      timestamp: Date.now(),
      outcome: showdownResult,
      streetBets,
      opponents,
      splitCount: splitWay,
    });

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
    return (
      <PokerSetupPlayers
        insets={insets}
        navigation={navigation}
        playerCount={playerCount}
        setPlayerCount={setPlayerCount}
        handleConfirmPlayerCount={handleConfirmPlayerCount}
        alertModal={alertModal}
      />
    );
  }

  if (viewMode === 'setup' && setupStep === 'blinds') {
    return (
      <PokerSetupBlinds
        insets={insets}
        BLIND_MODES={BLIND_MODES}
        blindMode={blindMode}
        handleBlindModeSelect={handleBlindModeSelect}
        smallBlind={smallBlind}
        setSmallBlind={setSmallBlind}
        bigBlind={bigBlind}
        setBigBlind={setBigBlind}
        chipDenominations={chipDenominations}
        setChipDenominations={setChipDenominations}
        currencySymbol={currencySymbol}
        setSetupStep={setSetupStep}
        handleFinishSetup={handleFinishSetup}
      />
    );
  }

  // ==========================================
  // VIEW 2: MULTI-PHASE HAND TRACKER
  // ==========================================
  if (viewMode === 'hand') {
    const isShowdown = currentStreetIdx === 4;

    const renderBetChips = (currentBet, onChipPress, onCall, who = 'your') => {
      const canCall = currentStreetMaxBet > currentBet;

      return (
        <>
          <View style={styles.blindCallRow}>
            {sbVal > 0 && (
              <TouchableOpacity
                style={[styles.blindCallBtn, styles.blindCallBtnBlind]}
                onPress={() => onChipPress(sbVal)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Post small blind, add ${currencySymbol}${formatAmount(sbVal)} to ${who} bet`}
              >
                <Text style={styles.blindCallBtnBlindText}>
                  SB +{currencySymbol}{formatAmount(sbVal)}
                </Text>
              </TouchableOpacity>
            )}
            {bbVal > 0 && (
              <TouchableOpacity
                style={[styles.blindCallBtn, styles.blindCallBtnBlind]}
                onPress={() => onChipPress(bbVal)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Post big blind, add ${currencySymbol}${formatAmount(bbVal)} to ${who} bet`}
              >
                <Text style={styles.blindCallBtnBlindText}>
                  BB +{currencySymbol}{formatAmount(bbVal)}
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
              accessibilityRole="button"
              accessibilityState={{ disabled: !canCall }}
              accessibilityLabel={
                canCall
                  ? `Call ${currencySymbol}${formatAmount(currentStreetMaxBet)} for ${who} bet`
                  : 'Call unavailable, no bet to match'
              }
            >
              <Text
                style={
                  canCall ? styles.blindCallBtnCallText : styles.blindCallBtnCallTextDisabled
                }
              >
                Call {currencySymbol}{formatAmount(currentStreetMaxBet)}
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
                accessibilityRole="button"
                accessibilityLabel={`Add ${currencySymbol}${formatAmount(chip)} to ${who} bet`}
              >
                <View style={styles.chipInnerCircle}>
                  <Text style={styles.chipText}>
                    +{currencySymbol}
                    {formatAmount(chip)}
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
        style={[screenStyles.container, { paddingTop: insets.top }]}
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

          <View style={screenStyles.navTitleContainer}>
            <LivePulseDot size={8} color={COLORS.danger} />
            <Text style={screenStyles.navTitle}>
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
                {renderBetChips(currentHeroBet, handleHeroChipPress, handleHeroCall, 'your')}
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
                        {formatNumber(oppTotalContributed)} total
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
                          () => handleOpponentCall(opp.id),
                          `${getPlayerLabel(opp.id)}'s`
                        )}
                      </>
                    )}

                    <TouchableOpacity
                      style={[styles.foldToggleBtn, opp.folded && styles.foldToggleBtnActive]}
                      onPress={() => handleToggleOpponentFold(opp.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={
                        opp.folded
                          ? `Undo fold for ${getPlayerLabel(opp.id)}`
                          : `Fold ${getPlayerLabel(opp.id)}`
                      }
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
                    + {currencySymbol}{formatNumber(effectiveTotalPot - heroTotalInvestment)}
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
                    - {currencySymbol}{formatNumber(heroTotalInvestment)}
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
                          {formatNumber(effectiveTotalPot / w)})
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
                    ? `+${currencySymbol}${formatNumber(effectiveTotalPot - heroTotalInvestment)}`
                    : showdownResult === 'split'
                    ? `${(effectiveTotalPot / splitWay - heroTotalInvestment) >= 0 ? '+' : ''}${currencySymbol}${formatNumber(effectiveTotalPot / splitWay - heroTotalInvestment)}`
                    : `-${currencySymbol}${formatNumber(heroTotalInvestment)}`}
                </Text>
                <Text style={styles.showdownSummarySub}>
                  Total Pot: {currencySymbol}{formatNumber(effectiveTotalPot)} • Your Bet: {currencySymbol}{formatNumber(heroTotalInvestment)}
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
                Take Pot ({foldWinNet >= 0 ? '+' : '-'}{currencySymbol}{formatNumber(Math.abs(foldWinNet))})
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
                  You committed {currencySymbol}{formatNumber(heroTotalInvestment)} up to {STREETS[currentStreetIdx]?.label}.
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
    <View style={[screenStyles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleLeaveSession}
          accessibilityRole="button"
          accessibilityLabel="Leave session and go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TrackerGuide gameType="Poker" navigation={navigation} />

        <View style={screenStyles.navTitleContainer}>
          <LivePulseDot size={8} color={COLORS.danger} />
          <Text style={screenStyles.navTitle}>Live Poker</Text>
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
                ? `STAKES: ${currencySymbol}${formatAmount(smallBlind)} / ${currencySymbol}${formatAmount(bigBlind)}`
                : blindMode === 'big'
                ? `STAKES: BB ${currencySymbol}${formatAmount(bigBlind)}`
                : 'CASUAL / NO BLINDS'}
            </Text>
          </View>

          <Text style={styles.statsSubtext}>SESSION NET OUTCOME</Text>
          <Text
            style={[
              styles.netAmount,
              {
                color:
                  netTone(sessionTotalNet, privacyMode),
              },
            ]}
          >
            {formatMoney(sessionTotalNet, currencySymbol, privacyMode)}
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
                          Bet: {formatMoney(h.heroInvestment, currencySymbol, privacyMode, { signed: false })} • Pot: {formatMoney(h.pot, currencySymbol, privacyMode, { signed: false })}
                        </Text>
                      </View>

                      <View style={styles.historyNetContainer}>
                        <Text
                          style={[
                            styles.historyNet,
                            {
                              color:
                                netTone(h.netChange, privacyMode),
                            },
                          ]}
                        >
                          {formatMoney(h.netChange, currencySymbol, privacyMode)}
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
                          <Text style={styles.streetGridItem}>Pre-Flop: {currencySymbol}{formatAmount(h.streets.preflop)}</Text>
                          <Text style={styles.streetGridItem}>Flop: {currencySymbol}{formatAmount(h.streets.flop)}</Text>
                          <Text style={styles.streetGridItem}>Turn: {currencySymbol}{formatAmount(h.streets.turn)}</Text>
                          <Text style={styles.streetGridItem}>River: {currencySymbol}{formatAmount(h.streets.river)}</Text>
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
