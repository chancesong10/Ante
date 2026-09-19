import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { screenStyles } from '../constants/screenStyles';
import { moderateScale } from '../constants/layout';
import { useGameSession } from '../context/SessionContext';
import { useSessionEndFx } from '../context/SessionEndFxContext';
import SwipeableRow from '../components/SwipeableRow';
import { usePreferences, DEFAULT_QUICK_CHIP_PRESETS } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import GuestModeBanner from '../components/GuestModeBanner';
import LivePulseDot from '../components/LivePulseDot';
import BlackjackOptionsSheet from '../components/BlackjackOptionsSheet';
import { RankPicker, CardFace } from '../components/BlackjackCards';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import {
  PLAYER_ACTIONS,
  actionLabel,
  describeHand,
  handLabel,
  normalizeBlackjackRules,
  rulesSummary,
  calcBlackjackNet,
  calcInsuranceNet,
} from '../utils/blackjackStrategy';
import { judgeRecord, calcStrategyAccuracy, hasCardDetail } from '../utils/blackjackDetailEngine';
import { formatAmount, formatMoney, formatNumber, netTone } from '../utils/format';
import { buildSplitRecord } from '../utils/blackjackHand';
import { tallyHands, handsOf } from '../utils/sessionTally';
import TrackerGuide from '../components/TrackerGuide';

// Laid out like the table: dealer on top, you below, then your bet, your play
// and the result. Card entry is opt-in from Options. With it off this is a
// quick tracker: a bet, a result, and whether you doubled, split or
// surrendered. With it on, the cards and your first play are logged too, and
// every hand is checked against basic strategy for the table's rules.

const emptyHand = () => ({ betAmount: '', doubled: false, outcome: null });

const OUTCOME_LABELS = { win: 'Win', loss: 'Loss', push: 'Push' };

// Without cards there's nothing to check Stand or Hit against, so only the
// plays that change the money are offered.
const QUICK_ACTIONS = ['double', 'split', 'surrender'];

// How a hand ended, offered once the cards and a win or loss are in. Optional:
// it only feeds the dealer-bust read in Insights, which counts tagged hands.
function endTagOptions({ cardsComplete, isNatural, action, outcome, dealerUp }) {
  if (!cardsComplete || isNatural || action === 'split' || action === 'surrender') return [];
  if (outcome === 'win') {
    return [
      { id: 'dealer_bust', label: 'Dealer busted' },
      { id: 'player_higher', label: 'Beat the dealer' },
    ];
  }
  if (outcome === 'loss') {
    return [
      // You can't bust a hand you stood on.
      ...(action !== 'stand' ? [{ id: 'player_bust', label: 'I busted' }] : []),
      { id: 'dealer_higher', label: 'Dealer beat me' },
      ...(dealerUp === 'A' || dealerUp === '10' ? [{ id: 'dealer_blackjack', label: 'Dealer blackjack' }] : []),
    ];
  }
  return [];
}

// Thin wrapper so every call site goes neutral under privacy mode too.
const toneOf = (v, privacyMode) => netTone(v, privacyMode);

// "10-6 vs 9 · Hit" and the strategy verdict, under a logged hand.
function HandDetailLine({ record }) {
  const verdict = judgeRecord(record);
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailText}>
        {record.playerCards.join('-')} vs {record.dealerUp}
        {record.action ? ` · ${actionLabel(record.action)}` : ''}
      </Text>
      {verdict && (
        <Text style={[styles.verdictText, { color: verdict.correct ? COLORS.success : COLORS.warning }]}>
          {verdict.correct ? '✓ Basic strategy' : `✗ Strategy says ${actionLabel(verdict.recommended)}`}
        </Text>
      )}
    </View>
  );
}

export default function BlackjackScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    activeSession,
    startSession,
    logHandToActiveSession,
    removeHandFromActiveSession,
    endActiveSession,
    discardActiveSession,
  } = useGameSession('Blackjack');
  const { endSessionWithFx } = useSessionEndFx();

  const {
    quickChipsEnabled,
    currencySymbol = '$',
    privacyMode = false,
    quickChipPresets,
    blackjackRules,
    blackjackCardEntry,
    updatePreferences,
  } = usePreferences();
  const chipPreset =
    Array.isArray(quickChipPresets?.blackjack) && quickChipPresets.blackjack.length > 0
      ? quickChipPresets.blackjack
      : DEFAULT_QUICK_CHIP_PRESETS.blackjack;
  const rules = normalizeBlackjackRules(blackjackRules);
  const cardEntry = blackjackCardEntry === true;

  useEffect(() => {
    if (!activeSession) {
      startSession('Blackjack');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [betAmount, setBetAmount] = useState('');
  const [dealerUp, setDealerUp] = useState(null);
  const [playerCards, setPlayerCards] = useState([]);
  const [action, setAction] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [endTag, setEndTag] = useState(null);
  const [insurance, setInsurance] = useState(false);
  const [dealerBlackjack, setDealerBlackjack] = useState(null);
  const [splitHand1, setSplitHand1] = useState(emptyHand());
  const [splitHand2, setSplitHand2] = useState(emptyHand());
  const [optionsOpen, setOptionsOpen] = useState(false);

  const hand = describeHand(playerCards);
  const hasHand = !!hand;
  const hasAnyCards = playerCards.length > 0 || dealerUp !== null;
  const cardsComplete = hasHand && dealerUp !== null;
  const isNatural = hasHand && hand.isBlackjack;
  const isPair = hasHand && hand.isPair;
  const isSplit = action === 'split';
  const isSurrender = action === 'surrender';
  // The dealer peeks before anyone acts, so a dealer blackjack means there was
  // no decision to make.
  const dealerHadBlackjack = endTag === 'dealer_blackjack' || dealerBlackjack === true;
  const insuranceOffered = cardsComplete && dealerUp === 'A' && !isSplit;

  const bet = parseFloat(betAmount);
  const betValid = !isNaN(bet) && bet > 0;

  const outcomeOptions = isNatural
    ? ['blackjack', 'push']
    : cardsComplete || action === 'double'
    ? ['win', 'loss', 'push']
    : ['win', 'blackjack', 'loss', 'push'];
  const outcomeKey = outcomeOptions.join(',');
  const tagOptions = endTagOptions({ cardsComplete, isNatural, action, outcome, dealerUp });
  const tagKey = tagOptions.map((t) => t.id).join(',');

  // Keep the form consistent as the cards, play and rules change under it.
  useEffect(() => {
    setOutcome((prev) => {
      if (isNatural && prev !== 'push') return 'blackjack';
      return prev && !outcomeKey.split(',').includes(prev) ? null : prev;
    });
  }, [outcomeKey, isNatural]);

  useEffect(() => {
    if (isNatural) setAction(null);
  }, [isNatural]);

  useEffect(() => {
    if ((action === 'split' && hasHand && !isPair) || (action === 'surrender' && !rules.surrender)) {
      setAction(null);
    }
  }, [action, hasHand, isPair, rules.surrender]);

  useEffect(() => {
    if (!insuranceOffered) {
      setInsurance(false);
      setDealerBlackjack(null);
    }
  }, [insuranceOffered]);

  useEffect(() => {
    if (endTag && !tagKey.split(',').includes(endTag)) setEndTag(null);
  }, [endTag, tagKey]);

  // Turning card entry off drops anything half-entered with it, along with a
  // Stand or Hit that only meant something next to the cards.
  useEffect(() => {
    if (cardEntry) return;
    setPlayerCards([]);
    setDealerUp(null);
    setAction((prev) => (QUICK_ACTIONS.includes(prev) ? prev : null));
  }, [cardEntry]);

  const actionDisabled = (id) => {
    if (isNatural || dealerHadBlackjack) return true;
    if (id === 'split') return hasHand && !isPair;
    return false;
  };
  const visibleActions = PLAYER_ACTIONS.filter(
    (a) => (a.id !== 'surrender' || rules.surrender) && (cardEntry || QUICK_ACTIONS.includes(a.id))
  );

  const pickDealer = (rank) => {
    hapticLight();
    setDealerUp((prev) => (prev === rank ? null : rank));
  };

  // With both cards in, another tap swaps the last card entered. Any other
  // card only changes by tapping it on the felt to take it back.
  const pickPlayer = (rank) => {
    hapticLight();
    setPlayerCards((prev) => (prev.length >= 2 ? [prev[0], rank] : [...prev, rank]));
  };

  const removePlayerCard = (index) => {
    hapticLight();
    setPlayerCards((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCards = () => {
    hapticLight();
    setPlayerCards([]);
    setDealerUp(null);
  };

  const pickAction = (id) => {
    if (actionDisabled(id)) return;
    hapticLight();
    if (id === action) {
      setAction(null);
      return;
    }
    if (id === 'split') {
      setSplitHand1({ ...emptyHand(), betAmount });
      setSplitHand2({ ...emptyHand(), betAmount });
    }
    setAction(id);
  };

  const pickOutcome = (value) => {
    hapticLight();
    setOutcome(value);
  };

  const pickTag = (id) => {
    hapticLight();
    if (endTag === id) {
      setEndTag(null);
      if (id === 'dealer_blackjack' && insurance) setDealerBlackjack(null);
      return;
    }
    setEndTag(id);
    if (id === 'dealer_blackjack') {
      setAction(null);
      if (insurance) setDealerBlackjack(true);
    } else if (insurance && dealerBlackjack) {
      setDealerBlackjack(false);
    }
  };

  const toggleInsurance = () => {
    hapticLight();
    setInsurance((v) => !v);
    setDealerBlackjack(null);
  };

  const answerDealerBlackjack = (yes) => {
    hapticLight();
    setDealerBlackjack(yes);
    if (yes) {
      setAction(null);
      if (isNatural) {
        setOutcome('push');
      } else {
        setOutcome('loss');
        setEndTag('dealer_blackjack');
      }
    } else if (endTag === 'dealer_blackjack') {
      setEndTag(null);
    }
  };

  const handleChipPress = (chipValue) => {
    hapticLight();
    setBetAmount((prev) => String((parseFloat(prev) || 0) + parseFloat(chipValue)));
  };

  const updateSplitHand = (which, field, value) => {
    const setter = which === 1 ? setSplitHand1 : setSplitHand2;
    setter((current) => ({ ...current, [field]: value }));
  };

  const handleSplitChipPress = (which, chipValue) => {
    hapticLight();
    const setter = which === 1 ? setSplitHand1 : setSplitHand2;
    setter((current) => ({
      ...current,
      betAmount: String((parseFloat(current.betAmount) || 0) + parseFloat(chipValue)),
    }));
  };

  const splitHandValid = (h) => {
    const b = parseFloat(h.betAmount);
    return !isNaN(b) && b > 0 && !!h.outcome;
  };

  // With card entry on, every hand needs its cards — a quick log without them
  // is what turning card entry off is for.
  let blocker = null;
  if (cardEntry && !cardsComplete) {
    if (dealerUp === null && !hasHand) blocker = "Add the dealer's upcard and your two cards";
    else if (dealerUp === null) blocker = "Add the dealer's upcard";
    else blocker = 'Add both of your cards';
  } else if (isSplit) {
    if (!splitHandValid(splitHand1) || !splitHandValid(splitHand2)) blocker = 'Enter a bet and result for both split hands';
  } else if (!betValid) {
    blocker = 'Enter your bet';
  } else if (!isSurrender && !outcome) {
    blocker = 'Pick how the hand ended';
  } else if (insurance && dealerBlackjack === null) {
    blocker = 'Say whether the dealer had blackjack';
  } else if (insurance && dealerBlackjack && !(outcome === 'loss' || (isNatural && outcome === 'push'))) {
    blocker = 'A dealer blackjack means this hand lost';
  }
  const canLog = blocker === null;
  const touched = betAmount !== '' || hasAnyCards || action !== null || outcome !== null;

  const resetForm = () => {
    setBetAmount('');
    setDealerUp(null);
    setPlayerCards([]);
    setAction(null);
    setOutcome(null);
    setEndTag(null);
    setInsurance(false);
    setDealerBlackjack(null);
    setSplitHand1(emptyHand());
    setSplitHand2(emptyHand());
  };

  const submitHand = () => {
    if (!canLog) return;
    hapticLight();
    const now = Date.now();

    // Card detail is all or nothing: a half-entered hand would feed the
    // strategy check a spot that never happened.
    const cardDetail = cardsComplete
      ? {
          playerCards: [...playerCards],
          dealerUp,
          ...(action ? { action } : {}),
          ...(endTag ? { endTag } : {}),
        }
      : {};

    if (isSplit) {
      // Assembly and per-hand net live in utils/blackjackHand — see its tests
      // for the doubled-half weighting and the rule that a split hand making
      // 21 is not a natural.
      logHandToActiveSession(
        buildSplitRecord({
          id: Crypto.randomUUID(),
          createdAt: now,
          hands: [splitHand1, splitHand2],
          rules,
          extra: cardDetail,
        })
      );
      resetForm();
      return;
    }

    // A natural that pushes is still a natural, for the blackjack-rate stat.
    const blackjack = outcome === 'blackjack' || isNatural;
    const finalOutcome = isSurrender ? 'loss' : outcome === 'blackjack' ? 'win' : outcome;
    const doubled = action === 'double';
    let netChange = calcBlackjackNet({
      bet,
      doubled,
      blackjack,
      outcome: finalOutcome,
      surrendered: isSurrender,
      payout: rules.payout,
    });

    // Insurance is folded into netChange so session totals stay right
    // everywhere; insuranceNet keeps it separable for the insights.
    let insuranceDetail = {};
    if (insurance && insuranceOffered) {
      const insuranceNet = calcInsuranceNet(bet, dealerBlackjack === true);
      netChange += insuranceNet;
      insuranceDetail = { insurance: true, insuranceNet, dealerBlackjack: dealerBlackjack === true };
    }

    logHandToActiveSession({
      id: Crypto.randomUUID(),
      type: 'single',
      bet,
      doubled,
      blackjack,
      outcome: finalOutcome,
      netChange,
      rules,
      createdAt: now,
      ...(isSurrender ? { surrendered: true } : {}),
      ...cardDetail,
      ...insuranceDetail,
    });
    resetForm();
  };

  // The session's running totals. Memoised on the hand list because this
  // screen re-renders on every keystroke in the bet field, and re-scanning
  // every hand played tonight to redraw four unchanged stat pills is work
  // that lands directly on the JS thread the keyboard is using.
  const sessionHands = handsOf(activeSession);
  const { tally, strategy } = useMemo(
    () => ({
      tally: tallyHands(sessionHands),
      strategy: calcStrategyAccuracy(sessionHands.filter(hasCardDetail)),
    }),
    [sessionHands]
  );
  const { count: handCount, net: totalNet, wins, losses, pushes } = tally;

  const handleEndSessionPress = () => {
    hapticSuccess();
    if (handCount === 0) {
      discardActiveSession();
      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }

    endSessionWithFx({
      net: totalNet,
      gameType: 'Blackjack',
      onCommit: () => endActiveSession(),
    });
  };

  const optionsSummary = `${cardEntry ? 'Cards on' : 'Cards off'} · ${rulesSummary(rules)}`;

  const outcomeActive = { win: styles.winActive, blackjack: styles.winActive, loss: styles.lossActive, push: styles.pushActive };
  const outcomeTextActive = {
    win: styles.outcomeTextActive,
    blackjack: styles.outcomeTextActive,
    loss: styles.outcomeTextLight,
    push: styles.outcomeTextLight,
  };

  const renderOutcomeRow = (options, current, onSelect) => (
    <View style={styles.outcomeRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          style={[styles.outcomeButton, current === o && outcomeActive[o]]}
          activeOpacity={0.7}
          onPress={() => onSelect(o)}
          accessibilityRole="button"
          accessibilityState={{ selected: current === o }}
        >
          {o === 'blackjack' ? (
            <Text
              style={[styles.outcomeText, current === o && outcomeTextActive[o]]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {rules.payout}
            </Text>
          ) : (
            <Text
              style={[styles.outcomeText, current === o && outcomeTextActive[o]]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {OUTCOME_LABELS[o]}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSplitHandForm = (which) => {
    const h = which === 1 ? splitHand1 : splitHand2;
    return (
      <View style={styles.splitHandBox}>
        <Text style={styles.splitHandTitle}>Split Hand {which}</Text>

        <Text style={styles.label}>Bet ({currencySymbol})</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 25"
          placeholderTextColor={COLORS.textMuted}
          value={h.betAmount}
          onChangeText={(v) => updateSplitHand(which, 'betAmount', v)}
        />

        {quickChipsEnabled && (
          <View style={styles.chipRow}>
            {chipPreset.map((chip) => (
              <TouchableOpacity key={chip} style={styles.chipButton} onPress={() => handleSplitChipPress(which, chip)}>
                <Text style={styles.chipText}>
                  {currencySymbol}
                  {formatAmount(chip)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.toggleButton, h.doubled && styles.toggleActive]}
          activeOpacity={0.7}
          onPress={() => {
            hapticLight();
            updateSplitHand(which, 'doubled', !h.doubled);
          }}
        >
          <Text style={[styles.toggleText, h.doubled && styles.toggleTextActive]}>Doubled after split</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Result</Text>
        {renderOutcomeRow(['win', 'loss', 'push'], h.outcome, (val) => {
          hapticLight();
          updateSplitHand(which, 'outcome', val);
        })}
      </View>
    );
  };

  const renderCardEntry = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>DEALER SHOWS</Text>
        {hasAnyCards && (
          <TouchableOpacity onPress={clearCards} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearText}>Clear cards</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.cardSlotRow}>
        <CardFace rank={dealerUp} onPress={dealerUp ? () => pickDealer(dealerUp) : undefined} label="Dealer upcard" />
      </View>
      <RankPicker selected={dealerUp ? [dealerUp] : []} onPick={pickDealer} label="Dealer upcard" />

      <View style={styles.feltDivider} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>YOUR CARDS</Text>
      </View>
      <View style={styles.cardSlotRow}>
        <CardFace rank={playerCards[0]} onPress={() => removePlayerCard(0)} label="Your first card" />
        <CardFace rank={playerCards[1]} onPress={() => removePlayerCard(1)} label="Your second card" />
        {hasHand && <Text style={styles.handTotal}>{handLabel(playerCards)}</Text>}
      </View>
      <RankPicker selected={playerCards} onPick={pickPlayer} label="Your card" />
      <Text style={styles.rankHint}>10 covers J, Q and K · tap a card on the felt to take it back</Text>

      {insuranceOffered && (
        <View style={styles.insuranceBox}>
          <TouchableOpacity
            style={styles.insuranceToggle}
            onPress={toggleInsurance}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: insurance }}
          >
            <Ionicons
              name={insurance ? 'checkbox' : 'square-outline'}
              size={18}
              color={insurance ? COLORS.primary : COLORS.textMuted}
            />
            <Text style={styles.insuranceText}>
              Took insurance{betValid ? ` (${currencySymbol}${formatNumber(bet / 2)})` : ''}
            </Text>
          </TouchableOpacity>
          {insurance && (
            <>
              <Text style={styles.subLabel}>Did the dealer have blackjack?</Text>
              <View style={styles.tagRow}>
                {[
                  { value: true, label: 'Yes' },
                  { value: false, label: 'No' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.tagChip, dealerBlackjack === opt.value && styles.tagChipActive]}
                    onPress={() => answerDealerBlackjack(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tagText, dealerBlackjack === opt.value && styles.tagTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      <View style={styles.feltDivider} />
    </>
  );

  return (
    <View style={[screenStyles.container, { paddingTop: insets.top }]}>
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TrackerGuide gameType="Blackjack" navigation={navigation} />

        <View style={screenStyles.navTitleContainer}>
          <LivePulseDot size={8} color={COLORS.danger} />
          <Text style={screenStyles.navTitle}>Live Blackjack</Text>
        </View>

        <TouchableOpacity style={styles.headerEndButton} activeOpacity={0.8} onPress={handleEndSessionPress}>
          <Ionicons name="stop-circle" size={16} color={COLORS.danger} style={{ marginRight: 4 }} />
          <Text style={styles.headerEndButtonText}>End Session</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + moderateScale(96) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!user && <GuestModeBanner />}

        {/* SESSION STATS */}
        <View style={[styles.statsBox, SHADOWS.card]}>
          <Text style={styles.statsSubtext}>SESSION NET OUTCOME</Text>
          <Text style={[styles.netAmount, { color: toneOf(totalNet, privacyMode) }]}>{formatMoney(totalNet, currencySymbol, privacyMode)}</Text>

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
              <Text style={styles.statPillValue}>{handCount}</Text>
            </View>
          </View>

          {/* Shown with card entry on, or while this session still has
              card-checked hands from before it was turned off. */}
          {(cardEntry || strategy) && (
            <View style={styles.strategyRow}>
              <Text style={styles.strategyLabel}>BASIC STRATEGY</Text>
              <Text
                style={[
                  styles.strategyValue,
                  strategy && {
                    color: strategy.rate >= 90 ? COLORS.success : strategy.rate >= 75 ? COLORS.warning : COLORS.danger,
                  },
                ]}
              >
                {strategy ? `${strategy.correct}/${strategy.judged} correct · ${strategy.rate.toFixed(0)}%` : '0/0 correct'}
              </Text>
            </View>
          )}
        </View>

        {/* OPTIONS */}
        <TouchableOpacity
          style={styles.optionsBar}
          activeOpacity={0.8}
          onPress={() => setOptionsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Options: ${optionsSummary}. Tap to change.`}
        >
          <Ionicons name="options-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.optionsBarLabel}>Options</Text>
          <Text style={styles.optionsBarValue} numberOfLines={1}>
            {optionsSummary}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* THE TABLE */}
        <View style={[styles.card, SHADOWS.card]}>
          {cardEntry && renderCardEntry()}

          {/* BET */}
          <Text style={[styles.label, { marginTop: 0 }]}>Bet ({currencySymbol})</Text>
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
              {chipPreset.map((chip) => (
                <TouchableOpacity key={chip} style={styles.chipButton} onPress={() => handleChipPress(chip)}>
                  <Text style={styles.chipText}>
                    {currencySymbol}
                    {formatAmount(chip)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* PLAY */}
          <Text style={styles.label}>{cardEntry ? 'Your play' : 'Play (optional)'}</Text>
          <View style={styles.actionRow}>
            {visibleActions.map((a) => {
              const active = action === a.id;
              const disabled = actionDisabled(a.id);
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.actionButton, active && styles.actionButtonActive, disabled && styles.actionButtonDisabled]}
                  onPress={() => pickAction(a.id)}
                  disabled={disabled}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled }}
                >
                  <Text
                    style={[styles.actionText, active && styles.actionTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isNatural && <Text style={styles.helperText}>Blackjack. There's no decision to make.</Text>}
          {!isNatural && dealerHadBlackjack && (
            <Text style={styles.helperText}>The dealer peeked and had blackjack, so there was no decision to make.</Text>
          )}
          {isSurrender && (
            <Text style={styles.helperText}>
              Surrender gives back half your bet{betValid ? ` (−${currencySymbol}${formatNumber(bet / 2)})` : ''}.
            </Text>
          )}

          {/* RESULT */}
          {isSplit ? (
            <>
              {renderSplitHandForm(1)}
              {renderSplitHandForm(2)}
            </>
          ) : (
            !isSurrender && (
              <>
                <Text style={styles.label}>Result</Text>
                {renderOutcomeRow(outcomeOptions, outcome, pickOutcome)}
                {tagOptions.length > 0 && (
                  <>
                    <Text style={styles.subLabel}>How did it end? (optional)</Text>
                    <View style={styles.tagRow}>
                      {tagOptions.map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.tagChip, endTag === t.id && styles.tagChipActive]}
                          onPress={() => pickTag(t.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.tagText, endTag === t.id && styles.tagTextActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )
          )}

          <TouchableOpacity
            style={[styles.submitButton, !canLog && styles.submitDisabled]}
            onPress={submitHand}
            disabled={!canLog}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{isSplit ? 'Log Split Hands' : 'Log Hand'}</Text>
          </TouchableOpacity>
          {touched && !!blocker && <Text style={styles.blockerText}>{blocker}</Text>}
        </View>

        {/* HANDS THIS SESSION */}
        {sessionHands.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Hands in Current Session</Text>
            <Text style={styles.swipeHint}>Swipe a hand to delete</Text>

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
                      {hasCardDetail(r) && <HandDetailLine record={r} />}
                      {r.hands.map((h, i) => (
                        <View key={i} style={styles.historyRow}>
                          <Text style={styles.historyText}>
                            Hand {i + 1}: {formatMoney(h.bet, currencySymbol, privacyMode, { signed: false })}
                            {h.doubled ? ' (2x)' : ''}
                            {h.blackjack ? ' (BJ)' : ''} — {h.outcome.toUpperCase()}
                          </Text>
                          <Text style={[styles.historyNet, { color: toneOf(h.netChange, privacyMode) }]}>
                            {formatMoney(h.netChange, currencySymbol, privacyMode)}
                          </Text>
                        </View>
                      ))}
                      <View style={styles.splitGroupTotalRow}>
                        <Text style={styles.splitGroupTotalLabel}>Split Combined</Text>
                        <Text style={[styles.historyNet, { color: toneOf(groupNet, privacyMode) }]}>{formatMoney(groupNet, currencySymbol, privacyMode)}</Text>
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
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.historyText}>
                        {currencySymbol}
                        {formatAmount(r.bet)}
                        {r.doubled ? ' (2x)' : ''}
                        {r.blackjack ? ' (BJ)' : ''}
                        {r.surrendered ? ' (surrender)' : ''}
                        {r.insurance ? ' (insured)' : ''} — {r.outcome.toUpperCase()}
                      </Text>
                      {hasCardDetail(r) && <HandDetailLine record={r} />}
                    </View>
                    <Text style={[styles.historyNet, { color: toneOf(r.netChange, privacyMode) }]}>{formatMoney(r.netChange, currencySymbol, privacyMode)}</Text>
                  </View>
                </SwipeableRow>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BlackjackOptionsSheet
        visible={optionsOpen}
        rules={rules}
        cardEntry={cardEntry}
        onChangeRules={(patch) => {
          hapticLight();
          updatePreferences({ blackjackRules: { ...rules, ...patch } });
        }}
        onChangeCardEntry={(value) => {
          hapticLight();
          updatePreferences({ blackjackCardEntry: value });
        }}
        onClose={() => setOptionsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  scroll: {
    padding: 16,
  },
  statsBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
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
    fontWeight: '700',
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
  strategyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  strategyLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  strategyValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  optionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  optionsBarLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  optionsBarValue: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'right' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1 },
  clearText: { fontSize: 12, color: COLORS.danger, fontWeight: '700' },
  cardSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 64,
    marginBottom: 12,
  },
  handTotal: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginLeft: 8 },
  rankHint: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
  feltDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 16 },
  insuranceBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    padding: 12,
  },
  insuranceToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insuranceText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginTop: 12, marginBottom: 6 },
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
  actionRow: { flexDirection: 'row', gap: 6 },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  actionButtonDisabled: { opacity: 0.35 },
  actionText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  actionTextActive: { color: COLORS.textDark },
  helperText: { fontSize: 11, color: COLORS.textMuted, marginTop: 8 },
  toggleButton: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 12,
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
  },
  outcomeButton: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
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
    backgroundColor: COLORS.neutral,
    borderColor: COLORS.neutralBorder,
  },
  outcomeText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  outcomeTextActive: {
    color: COLORS.textDark,
  },
  outcomeTextLight: {
    color: COLORS.textPrimary,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tagChipActive: { backgroundColor: COLORS.cardElevated, borderColor: COLORS.cardBorderHighlight },
  tagText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  tagTextActive: { color: COLORS.textPrimary },
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
    fontWeight: '700',
    fontSize: 15,
  },
  blockerText: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 },
  splitHandBox: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  splitHandTitle: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
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
  detailLine: { marginTop: 4, marginBottom: 2 },
  detailText: { fontSize: 12, color: COLORS.textSecondary },
  verdictText: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
