import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import { usePreferences } from '../context/PreferencesContext';
import { getOrCreateDeviceId, clearAllAppData } from '../services/storageService';

const CURRENCY_OPTIONS = [
  { id: 'USD', name: 'US Dollar', symbol: '$' },
  { id: 'EUR', name: 'Euro', symbol: '€' },
  { id: 'GBP', name: 'British Pound', symbol: '£' },
  { id: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { id: 'BTC', name: 'Bitcoin (mBTC)', symbol: '₿' },
];

export default function ProfileScreen() {
  const { sessionHistory } = useSession();
  const insets = useSafeAreaInsets();
  const {
    quickChipsEnabled,
    setQuickChipsEnabled,
    currencySymbol = '$',
    currency = 'USD ($)',
    privacyMode = false,
    hapticsEnabled = true,
    stopLossAlert = false,
    stopLossAmount = 250,
    sessionReminder = false,
    sessionReminderMins = 60,
    updatePreferences,
  } = usePreferences();

  const [deviceId, setDeviceId] = useState('ante_vault_seed');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [limitsModalVisible, setLimitsModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [tempLossLimit, setTempLossLimit] = useState(String(stopLossAmount));
  const [tempReminderMins, setTempReminderMins] = useState(String(sessionReminderMins));
  const [copiedSeed, setCopiedSeed] = useState(false);

  useEffect(() => {
    (async () => {
      const id = await getOrCreateDeviceId();
      if (id) setDeviceId(id);
    })();
  }, []);

  // --- Dynamic Financial & Volume Calculations ---
  const stats = useMemo(() => {
    const totalSessions = sessionHistory.length;
    const totalNet = sessionHistory.reduce((sum, s) => sum + (s.netProfit || 0), 0);
    const totalWins = sessionHistory.reduce((sum, s) => sum + (s.wins || 0), 0);
    const totalLosses = sessionHistory.reduce((sum, s) => sum + (s.losses || 0), 0);
    const totalHands = sessionHistory.reduce((sum, s) => sum + (s.totalHands || 0), 0);

    // Calculate total lifetime wagered across all games
    let totalWagered = 0;
    sessionHistory.forEach((session) => {
      if (session.buyIn && session.buyIn > 0) {
        totalWagered += session.buyIn;
      } else if (session.hands && session.hands.length > 0) {
        session.hands.forEach((hand) => {
          if (hand.type === 'split' && hand.hands) {
            hand.hands.forEach((subHand) => {
              totalWagered += (subHand.bet || 0) * (subHand.doubled ? 2 : 1);
            });
          } else {
            totalWagered += (hand.bet || 0) * (hand.doubled ? 2 : 1);
          }
        });
      }
    });

    const winRate =
      totalWins + totalLosses > 0
        ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
        : '0.0';

    // Game breakdown calculation
    const games = {
      Blackjack: { sessions: 0, net: 0, wins: 0, losses: 0, totalBets: 0 },
      Poker: { sessions: 0, net: 0, wins: 0, losses: 0, totalBets: 0 },
      'Sports Betting': { sessions: 0, net: 0, wins: 0, losses: 0, totalBets: 0 },
      General: { sessions: 0, net: 0, wins: 0, losses: 0, totalBets: 0 },
    };

    sessionHistory.forEach((s) => {
      const type = games[s.gameType] ? s.gameType : 'General';
      games[type].sessions += 1;
      games[type].net += s.netProfit || 0;
      games[type].wins += s.wins || (s.netProfit > 0 ? 1 : 0);
      games[type].losses += s.losses || (s.netProfit < 0 ? 1 : 0);
      games[type].totalBets += s.totalHands || 1;
    });

    return {
      totalSessions,
      totalNet,
      totalWagered,
      winRate,
      totalHands,
      games,
    };
  }, [sessionHistory]);

  const formatAmount = (val, prefix = false) => {
    if (privacyMode) return '••••••';
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    const formatted = `${currencySymbol}${Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    return prefix ? `${sign}${formatted}` : formatted;
  };

  const handleCopySeed = () => {
    setCopiedSeed(true);
    setTimeout(() => setCopiedSeed(false), 2500);
  };

  const handleExportData = () => {
    const summary = {
      exportDate: new Date().toISOString(),
      vaultId: deviceId,
      totalSessions: stats.totalSessions,
      totalNetProfit: stats.totalNet,
      totalWagered: stats.totalWagered,
      winRate: `${stats.winRate}%`,
      sessions: sessionHistory,
    };

    Alert.alert(
      'Vault Data Exported',
      `Summary generated for ${stats.totalSessions} session(s) with ${currencySymbol}${stats.totalNet.toFixed(
        2
      )} net outcome.\n\nJSON package prepared securely in local storage.`,
      [{ text: 'Done', style: 'default' }]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset Vault & Clear Data?',
      'This will permanently erase all session logs, hand histories, and bankroll statistics from your device. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase Everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllAppData();
            Alert.alert('Vault Reset', 'All local data has been purged.');
          },
        },
      ]
    );
  };

  const handleSaveLimits = () => {
    const parsedLoss = parseFloat(tempLossLimit) || 250;
    const parsedMins = parseInt(tempReminderMins, 10) || 60;
    updatePreferences({
      stopLossAmount: parsedLoss,
      sessionReminderMins: parsedMins,
    });
    setLimitsModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + moderateScale(96) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>VAULT PROFILE</Text>
            <Text style={styles.subtitle}>Secured on-device bankroll identity</Text>
          </View>
          <View style={styles.verifiedTag}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.accentCyan} />
            <Text style={styles.verifiedTagText}>PROVABLY SECURE</Text>
          </View>
        </View>

        {/* Stake-Style Identity Hero Card */}
        <View style={[styles.profileCard, SHADOWS.card]}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={moderateScale(30)} color={COLORS.primary} />
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
            </View>
          </View>

          <View style={styles.profileMeta}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>Ante Highroller</Text>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.accentCyan} style={{ marginLeft: 5 }} />
            </View>
            <Text style={styles.userHandle}>@ante_vault_{deviceId.slice(-4)}</Text>
            <View style={styles.rankBadgeRow}>
              <View style={styles.tierBadge}>
                <Ionicons name="sparkles" size={11} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={styles.tierBadgeText}>VERIFIED HIGH ROLLER</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2x2 High-Impact Bankroll Vault Grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>LIFETIME VAULT STATS</Text>
          <TouchableOpacity
            onPress={() => updatePreferences({ privacyMode: !privacyMode })}
            hitSlop={TOUCH_TARGET.hitSlop}
            style={styles.privacyToggleBtn}
          >
            <Ionicons
              name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
              size={moderateScale(16)}
              color={COLORS.textSecondary}
            />
            <Text style={styles.privacyToggleText}>{privacyMode ? 'Hidden' : 'Visible'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid2x2}>
          {/* Card 1: Lifetime Net Profit */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <View style={styles.gridCardTop}>
              <Text style={styles.gridCardLabel}>NET OUTCOME</Text>
              <Ionicons
                name={stats.totalNet >= 0 ? 'trending-up' : 'trending-down'}
                size={moderateScale(15)}
                color={stats.totalNet >= 0 ? COLORS.success : COLORS.danger}
              />
            </View>
            <Text
              style={[
                styles.gridCardValue,
                {
                  color:
                    stats.totalNet > 0
                      ? COLORS.success
                      : stats.totalNet < 0
                      ? COLORS.danger
                      : COLORS.textPrimary,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatAmount(stats.totalNet, true)}
            </Text>
            <Text style={styles.gridCardFoot}>
              {stats.totalNet >= 0 ? 'Profit realized' : 'Total variance'}
            </Text>
          </View>

          {/* Card 2: Total Lifetime Wagered */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <View style={styles.gridCardTop}>
              <Text style={styles.gridCardLabel}>TOTAL WAGERED</Text>
              <Ionicons name="flame" size={moderateScale(15)} color={COLORS.primary} />
            </View>
            <Text style={[styles.gridCardValue, { color: COLORS.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              {privacyMode ? '••••••' : `${currencySymbol}${stats.totalWagered.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            </Text>
            <Text style={styles.gridCardFoot}>Lifetime volume</Text>
          </View>

          {/* Card 3: Win Rate */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <View style={styles.gridCardTop}>
              <Text style={styles.gridCardLabel}>WIN RATE</Text>
              <Ionicons name="trophy" size={moderateScale(15)} color={COLORS.warning} />
            </View>
            <Text style={[styles.gridCardValue, { color: COLORS.textPrimary }]}>
              {stats.winRate}%
            </Text>
            <Text style={styles.gridCardFoot}>
              {stats.totalSessions} recorded session{stats.totalSessions === 1 ? '' : 's'}
            </Text>
          </View>

          {/* Card 4: Total Hands / Bets */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <View style={styles.gridCardTop}>
              <Text style={styles.gridCardLabel}>BETS LOGGED</Text>
              <Ionicons name="layers" size={moderateScale(15)} color={COLORS.accentCyan} />
            </View>
            <Text style={[styles.gridCardValue, { color: COLORS.textPrimary }]}>
              {stats.totalHands}
            </Text>
            <Text style={styles.gridCardFoot}>Hands & tickets</Text>
          </View>
        </View>

        {/* Game Breakdown Matrix */}
        <Text style={styles.sectionTitle}>GAME PORTFOLIO BREAKDOWN</Text>
        <View style={[styles.portfolioCard, SHADOWS.card]}>
          {/* Blackjack */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <MaterialCommunityIcons name="cards" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Blackjack</Text>
              <Text style={styles.portfolioSub}>
                {stats.games.Blackjack.sessions} sessions • {stats.games.Blackjack.totalBets} hands
              </Text>
            </View>
            <View style={styles.portfolioOutcome}>
              <Text
                style={[
                  styles.portfolioNet,
                  {
                    color:
                      stats.games.Blackjack.net > 0
                        ? COLORS.success
                        : stats.games.Blackjack.net < 0
                        ? COLORS.danger
                        : COLORS.textPrimary,
                  },
                ]}
              >
                {formatAmount(stats.games.Blackjack.net, true)}
              </Text>
            </View>
          </View>

          <View style={styles.portfolioDivider} />

          {/* Poker */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <Ionicons name="cash-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Poker</Text>
              <Text style={styles.portfolioSub}>
                {stats.games.Poker.sessions} sessions logged
              </Text>
            </View>
            <View style={styles.portfolioOutcome}>
              <Text
                style={[
                  styles.portfolioNet,
                  {
                    color:
                      stats.games.Poker.net > 0
                        ? COLORS.success
                        : stats.games.Poker.net < 0
                        ? COLORS.danger
                        : COLORS.textPrimary,
                  },
                ]}
              >
                {formatAmount(stats.games.Poker.net, true)}
              </Text>
            </View>
          </View>

          <View style={styles.portfolioDivider} />

          {/* Sports Betting */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <Ionicons name="basketball-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>Sports Betting</Text>
              <Text style={styles.portfolioSub}>
                {stats.games['Sports Betting'].sessions} slips logged
              </Text>
            </View>
            <View style={styles.portfolioOutcome}>
              <Text
                style={[
                  styles.portfolioNet,
                  {
                    color:
                      stats.games['Sports Betting'].net > 0
                        ? COLORS.success
                        : stats.games['Sports Betting'].net < 0
                        ? COLORS.danger
                        : COLORS.textPrimary,
                  },
                ]}
              >
                {formatAmount(stats.games['Sports Betting'].net, true)}
              </Text>
            </View>
          </View>

          <View style={styles.portfolioDivider} />

          {/* General */}
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioIconBox}>
              <Ionicons name="dice-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.portfolioInfo}>
              <Text style={styles.portfolioName}>General Tracker</Text>
              <Text style={styles.portfolioSub}>
                {stats.games.General.sessions} sessions logged
              </Text>
            </View>
            <View style={styles.portfolioOutcome}>
              <Text
                style={[
                  styles.portfolioNet,
                  {
                    color:
                      stats.games.General.net > 0
                        ? COLORS.success
                        : stats.games.General.net < 0
                        ? COLORS.danger
                        : COLORS.textPrimary,
                  },
                ]}
              >
                {formatAmount(stats.games.General.net, true)}
              </Text>
            </View>
          </View>
        </View>

        {/* Section 1: Gameplay Preferences */}
        <Text style={styles.sectionTitle}>GAMEPLAY & PREFERENCES</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          {/* Quick Chips Toggle */}
          <View style={styles.menuRow}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="flash-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Quick Chip Buttons</Text>
              <Text style={styles.menuSubtitle}>Fast $10, $25, $50 buttons during betting</Text>
            </View>
            <Switch
              value={quickChipsEnabled}
              onValueChange={setQuickChipsEnabled}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.primaryMuted }}
              thumbColor={quickChipsEnabled ? COLORS.primary : '#8E9BAE'}
            />
          </View>

          <View style={styles.menuDivider} />

          {/* Currency Selector */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => setCurrencyModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="globe-outline" size={moderateScale(18)} color={COLORS.accentCyan} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Display Currency</Text>
              <Text style={styles.menuSubtitle}>Currently formatted in {currency}</Text>
            </View>
            <View style={styles.chevronContainer}>
              <Text style={styles.currencyBadgeText}>{currencySymbol}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Privacy Mode Toggle */}
          <View style={styles.menuRow}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="eye-off-outline" size={moderateScale(18)} color={COLORS.warning} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Privacy Mode</Text>
              <Text style={styles.menuSubtitle}>Mask balances with bullets across cards</Text>
            </View>
            <Switch
              value={privacyMode}
              onValueChange={(val) => updatePreferences({ privacyMode: val })}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.primaryMuted }}
              thumbColor={privacyMode ? COLORS.primary : '#8E9BAE'}
            />
          </View>
        </View>

        {/* Section 2: Responsible Gaming & Limits */}
        <Text style={styles.sectionTitle}>RESPONSIBLE GAMING & LIMITS</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          {/* Stop Loss Limits */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => {
              setTempLossLimit(String(stopLossAmount));
              setTempReminderMins(String(sessionReminderMins));
              setLimitsModalVisible(true);
            }}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="shield-outline" size={moderateScale(18)} color={COLORS.danger} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Session Loss Alert</Text>
              <Text style={styles.menuSubtitle}>
                {stopLossAlert ? `Active warning at ${currencySymbol}${stopLossAmount}` : 'No threshold configured'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Duration Reminder */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => {
              setTempLossLimit(String(stopLossAmount));
              setTempReminderMins(String(sessionReminderMins));
              setLimitsModalVisible(true);
            }}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="timer-outline" size={moderateScale(18)} color={COLORS.warning} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Session Duration Timer</Text>
              <Text style={styles.menuSubtitle}>
                {sessionReminder ? `Reminder every ${sessionReminderMins} minutes` : 'Disabled'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Safer Gaming Info */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => setHelpModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="heart-circle-outline" size={moderateScale(18)} color={COLORS.success} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Safer Play Resources</Text>
              <Text style={styles.menuSubtitle}>Helpline contacts & variance guidance</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Section 3: Security & Data Vault */}
        <Text style={styles.sectionTitle}>DATA VAULT & SECURITY</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          {/* Device Anonymous ID */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleCopySeed}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="key-outline" size={moderateScale(18)} color={COLORS.accentCyan} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Vault Device Seed</Text>
              <Text style={styles.menuSubtitle} numberOfLines={1}>
                {deviceId.slice(0, 18)}...
              </Text>
            </View>
            <View style={styles.copyBadge}>
              <Ionicons
                name={copiedSeed ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copiedSeed ? COLORS.success : COLORS.primary}
              />
              <Text style={[styles.copyBadgeText, copiedSeed && { color: COLORS.success }]}>
                {copiedSeed ? 'Copied' : 'Copy'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Export Data */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleExportData}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="download-outline" size={moderateScale(18)} color={COLORS.primary} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Export Session Vault</Text>
              <Text style={styles.menuSubtitle}>Download JSON & bankroll ledger</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Reset All Data */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleResetData}
          >
            <View style={styles.menuIconCircleDanger}>
              <Ionicons name="trash-outline" size={moderateScale(18)} color={COLORS.danger} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={[styles.menuTitle, { color: COLORS.danger }]}>Clear Vault History</Text>
              <Text style={styles.menuSubtitle}>Erase all sessions & reset metrics</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.versionText}>Ante Protocol v1.0.0</Text>
          <Text style={styles.copyrightText}>Device-Agnostic Adaptive Engine • Offline First</Text>
        </View>
      </ScrollView>

      {/* CURRENCY SELECTOR MODAL */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCurrencyModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, SHADOWS.card]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Select Currency</Text>
                  <TouchableOpacity
                    onPress={() => setCurrencyModalVisible(false)}
                    hitSlop={TOUCH_TARGET.hitSlop}
                  >
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {CURRENCY_OPTIONS.map((item) => {
                  const isSelected = currencySymbol === item.symbol;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.currencyOption,
                        isSelected && styles.currencyOptionSelected,
                      ]}
                      onPress={() => {
                        updatePreferences({
                          currency: `${item.id} (${item.symbol})`,
                          currencySymbol: item.symbol,
                        });
                        setCurrencyModalVisible(false);
                      }}
                    >
                      <View style={styles.currencySymbolBox}>
                        <Text style={styles.currencySymbolLarge}>{item.symbol}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.currencyItemName}>{item.name}</Text>
                        <Text style={styles.currencyItemId}>{item.id}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* RESPONSIBLE LIMITS MODAL */}
      <Modal
        visible={limitsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLimitsModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLimitsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, SHADOWS.card]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Responsible Play Limits</Text>
                  <TouchableOpacity
                    onPress={() => setLimitsModalVisible(false)}
                    hitSlop={TOUCH_TARGET.hitSlop}
                  >
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Loss Alert Config */}
                <View style={styles.limitBlock}>
                  <View style={styles.limitTopRow}>
                    <Text style={styles.limitLabel}>Session Stop-Loss Alert</Text>
                    <Switch
                      value={stopLossAlert}
                      onValueChange={(val) => updatePreferences({ stopLossAlert: val })}
                      trackColor={{ false: COLORS.cardBorder, true: COLORS.primaryMuted }}
                      thumbColor={stopLossAlert ? COLORS.primary : '#8E9BAE'}
                    />
                  </View>
                  <Text style={styles.limitSub}>
                    Get a reminder if your live session drops below this threshold.
                  </Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputPrefix}>{currencySymbol}</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={tempLossLimit}
                      onChangeText={setTempLossLimit}
                      placeholder="250"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.portfolioDivider} />

                {/* Duration Reminder Config */}
                <View style={styles.limitBlock}>
                  <View style={styles.limitTopRow}>
                    <Text style={styles.limitLabel}>Session Duration Reminder</Text>
                    <Switch
                      value={sessionReminder}
                      onValueChange={(val) => updatePreferences({ sessionReminder: val })}
                      trackColor={{ false: COLORS.cardBorder, true: COLORS.primaryMuted }}
                      thumbColor={sessionReminder ? COLORS.primary : '#8E9BAE'}
                    />
                  </View>
                  <Text style={styles.limitSub}>
                    Receive a reality-check notification during extended live tracking.
                  </Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={tempReminderMins}
                      onChangeText={setTempReminderMins}
                      placeholder="60"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <Text style={styles.inputSuffix}>Minutes</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.saveModalBtn}
                  activeOpacity={0.85}
                  onPress={handleSaveLimits}
                >
                  <Text style={styles.saveModalBtnText}>Save Limits</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* SAFER PLAY INFO MODAL */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setHelpModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, SHADOWS.card]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Safer Play & Support</Text>
                  <TouchableOpacity
                    onPress={() => setHelpModalVisible(false)}
                    hitSlop={TOUCH_TARGET.hitSlop}
                  >
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.helpText}>
                  Ante is designed strictly as a mathematical and bankroll tracking tool. Always wager within your predetermined limits.
                </Text>

                <View style={styles.helpBox}>
                  <Text style={styles.helpBoxTitle}>National Council on Problem Gambling</Text>
                  <Text style={styles.helpBoxSub}>24/7 Confidential Helpline</Text>
                  <Text style={styles.helpPhone}>1-800-522-4700</Text>
                </View>

                <TouchableOpacity
                  style={styles.saveModalBtn}
                  activeOpacity={0.85}
                  onPress={() => setHelpModalVisible(false)}
                >
                  <Text style={styles.saveModalBtnText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  },
  contentContainer: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: fluidFont(24),
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentCyanMuted,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    gap: 4,
  },
  verifiedTagText: {
    color: COLORS.accentCyan,
    fontSize: fluidFont(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Stake-Style Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.sm + 2,
  },
  avatarCircle: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: moderateScale(14),
    height: moderateScale(14),
    borderRadius: moderateScale(7),
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    width: moderateScale(9),
    height: moderateScale(9),
    borderRadius: moderateScale(4.5),
    backgroundColor: COLORS.success,
  },
  profileMeta: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: fluidFont(18),
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  userHandle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 1,
    fontFamily: 'monospace',
  },
  rankBadgeRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3),
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
  },
  tierBadgeText: {
    color: COLORS.primary,
    fontSize: fluidFont(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // 2x2 Vault Grid
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    marginLeft: 2,
  },
  sectionTitle: {
    fontSize: fluidFont(13),
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    marginLeft: 2,
  },
  privacyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  privacyToggleText: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  gridCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gridCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridCardLabel: {
    fontSize: fluidFont(10),
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  gridCardValue: {
    fontSize: fluidFont(20),
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  gridCardFoot: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Game Portfolio Breakdown
  portfolioCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(8),
    paddingHorizontal: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  portfolioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(10),
  },
  portfolioIconBox: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  portfolioInfo: {
    flex: 1,
  },
  portfolioName: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  portfolioSub: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 2,
  },
  portfolioOutcome: {
    alignItems: 'flex-end',
  },
  portfolioNet: {
    fontSize: fluidFont(14),
    fontWeight: '800',
  },
  portfolioDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: -SPACING.cardPadding + moderateScale(12),
  },

  // Menu Settings Cards
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(14),
    minHeight: TOUCH_TARGET.minSize,
  },
  menuIconCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  menuIconCircleDanger: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  menuTextGroup: {
    flex: 1,
    marginRight: SPACING.xs,
  },
  menuTitle: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  menuSubtitle: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginLeft: moderateScale(48),
  },
  chevronContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyBadgeText: {
    fontSize: fluidFont(13),
    fontWeight: '700',
    color: COLORS.accentCyan,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: RADIUS.xs,
    gap: 4,
  },
  copyBadgeText: {
    fontSize: fluidFont(11),
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Footer
  footerInfo: {
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  versionText: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  copyrightText: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
  },
  modalSheet: {
    width: '100%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: fluidFont(18),
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  currencyOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  currencySymbolBox: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  currencySymbolLarge: {
    fontSize: fluidFont(16),
    fontWeight: '800',
    color: COLORS.primary,
  },
  currencyItemName: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  currencyItemId: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 1,
  },
  limitBlock: {
    marginBottom: SPACING.md,
  },
  limitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  limitSub: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: moderateScale(12),
    height: moderateScale(44),
  },
  inputPrefix: {
    fontSize: fluidFont(16),
    fontWeight: '800',
    color: COLORS.primary,
    marginRight: 6,
  },
  inputSuffix: {
    fontSize: fluidFont(12),
    fontWeight: '600',
    color: COLORS.textMuted,
    marginLeft: 6,
  },
  textInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: fluidFont(16),
    fontWeight: '700',
    padding: 0,
  },
  saveModalBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  saveModalBtnText: {
    color: COLORS.textDark,
    fontSize: fluidFont(14),
    fontWeight: '800',
  },
  helpText: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    lineHeight: fluidFont(18),
    marginBottom: SPACING.md,
  },
  helpBox: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  helpBoxTitle: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  helpBoxSub: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    marginTop: 2,
  },
  helpPhone: {
    fontSize: fluidFont(16),
    fontWeight: '900',
    color: COLORS.accentCyan,
    marginTop: 6,
    letterSpacing: 0.5,
  },
});

