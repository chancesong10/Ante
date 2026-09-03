import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { PLUS_NAME } from '../constants/brand';
import Toggle from '../components/Toggle';
import { useVisibleSessionHistory } from '../context/SyncContext';
import { usePreferences, DEFAULT_QUICK_CHIP_PRESETS } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { usePurchases } from '../context/PurchasesContext';
import { ANTE_PRO_ENTITLEMENT_ID } from '../services/purchasesService';
import { getOrCreateDeviceId } from '../services/storageService';

const CURRENCY_OPTIONS = [
  { id: 'USD', name: 'US Dollar', symbol: '$' },
  { id: 'EUR', name: 'Euro', symbol: '€' },
  { id: 'GBP', name: 'British Pound', symbol: '£' },
  { id: 'CAD', name: 'Canadian Dollar', symbol: '$' },
];

const CHIP_PRESET_GAMES = [
  { id: 'blackjack', label: 'Blackjack', count: 5 },
  { id: 'poker', label: 'Poker', count: 6 },
  { id: 'sports', label: 'Sports', count: 5 },
];

export default function ProfileScreen({ navigation }) {
  const { sessionHistory } = useVisibleSessionHistory();
  const { user, profile, signOut } = useAuth();
  const {
    isPro,
    isLoading: purchasesLoading,
    customerInfo,
    presentPaywall,
  } = usePurchases();
  const insets = useSafeAreaInsets();
  const {
    quickChipsEnabled = true,
    setQuickChipsEnabled,
    currencySymbol = '$',
    currency = 'USD ($)',
    privacyMode = false,
    stopLossAlert = false,
    stopLossAmount = 250,
    updatePreferences,
    quickChipPresets = DEFAULT_QUICK_CHIP_PRESETS,
    setQuickChipPreset,
  } = usePreferences();

  const [deviceId, setDeviceId] = useState('ante_vault_seed');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [limitsModalVisible, setLimitsModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [chipPresetModalVisible, setChipPresetModalVisible] = useState(false);
  const [chipPresetGame, setChipPresetGame] = useState('blackjack');
  const [tempChips, setTempChips] = useState([]);

  // Temporary local state for modal controls
  const [tempStopLossAlert, setTempStopLossAlert] = useState(stopLossAlert);
  const [tempLossLimit, setTempLossLimit] = useState(String(stopLossAmount));
  const [copiedSeed, setCopiedSeed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeProEntitlement = customerInfo?.entitlements?.active?.[ANTE_PRO_ENTITLEMENT_ID];
  const proPlanLabel = activeProEntitlement
    ? activeProEntitlement.expirationDate
      ? activeProEntitlement.willRenew
        ? `Renews ${new Date(activeProEntitlement.expirationDate).toLocaleDateString()}`
        : `Expires ${new Date(activeProEntitlement.expirationDate).toLocaleDateString()}`
      : 'Lifetime access'
    : null;

  const handleUpgradePress = async () => {
    await presentPaywall();
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('ProfileScreen: sign out failed', err);
    } finally {
      setSigningOut(false);
    }
  };

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

    let totalWagered = 0;
    let totalBetsCount = 0;

    sessionHistory.forEach((session) => {
      if (session.mode === 'hands' && Array.isArray(session.hands)) {
        const hands = session.hands.flatMap((r) => (r.type === 'split' && r.hands ? r.hands : [r]));
        const handBets = hands.reduce((sum, h) => sum + (h.bet || 0) * (h.doubled ? 2 : 1), 0);
        totalWagered += handBets;
        totalBetsCount += hands.length;
      } else {
        const stake = session.buyIn || Math.abs(session.netProfit || 0);
        totalWagered += stake;
        totalBetsCount += 1;
      }
    });

    const winRate =
      totalWins + totalLosses > 0
        ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)
        : '0.0';

    return {
      totalSessions,
      totalNet,
      totalWagered,
      winRate,
      totalHands: totalBetsCount,
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

  const handleCopySeed = async () => {
    await Clipboard.setStringAsync(deviceId);
    setCopiedSeed(true);
    setTimeout(() => setCopiedSeed(false), 2500);
  };

  const handleOpenLimitsModal = () => {
    setTempStopLossAlert(stopLossAlert);
    setTempLossLimit(String(stopLossAmount));
    setLimitsModalVisible(true);
  };

  const handleSaveLimits = () => {
    const parsedLoss = Math.max(1, parseFloat(tempLossLimit) || 250);
    if (updatePreferences) {
      updatePreferences({
        stopLossAlert: tempStopLossAlert,
        stopLossAmount: parsedLoss,
      });
    }
    setLimitsModalVisible(false);
  };

  const loadChipDraft = (game) => {
    const cfg = CHIP_PRESET_GAMES.find((g) => g.id === game) || CHIP_PRESET_GAMES[0];
    const existing = (quickChipPresets?.[game] || DEFAULT_QUICK_CHIP_PRESETS[game] || []).map(String);
    setChipPresetGame(game);
    setTempChips(Array.from({ length: cfg.count }, (_, i) => existing[i] ?? ''));
  };

  const handleOpenChipPresetModal = () => {
    loadChipDraft('blackjack');
    setChipPresetModalVisible(true);
  };

  const handleSaveChipPreset = () => {
    let cleaned = tempChips
      .map((c) => parseFloat(c))
      .filter((n) => !isNaN(n) && n > 0)
      .map(String);

    if (cleaned.length === 0) {
      cleaned = [...DEFAULT_QUICK_CHIP_PRESETS[chipPresetGame]];
    }

    // Poker's setup grid is fixed at six slots — keep the saved set that length.
    if (chipPresetGame === 'poker') {
      const base = DEFAULT_QUICK_CHIP_PRESETS.poker;
      while (cleaned.length < 6) cleaned.push(base[cleaned.length] || base[base.length - 1]);
      cleaned = cleaned.slice(0, 6);
    }

    setQuickChipPreset?.(chipPresetGame, cleaned);
    setChipPresetModalVisible(false);
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
        </View>

        {/* Identity Hero Card — real account once signed in, anonymous otherwise */}
        <View style={[styles.profileCard, SHADOWS.card]}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={moderateScale(28)} color={COLORS.primary} />
            </View>
            {!!user && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
              </View>
            )}
          </View>

          <View style={styles.profileMeta}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{user ? (profile?.username || 'Ante Highroller') : 'Guest'}</Text>
              {!!user && (
                <Ionicons name="checkmark-circle" size={16} color={COLORS.accentCyan} style={{ marginLeft: 5 }} />
              )}
            </View>
            {!!user && (
              <Text style={styles.userHandle} numberOfLines={1}>
                {user?.email}
              </Text>
            )}
          </View>
        </View>

        {user ? (
          <TouchableOpacity
            style={[styles.signOutButton, SHADOWS.card]}
            activeOpacity={0.8}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Ionicons name="log-out-outline" size={16} color={COLORS.danger} />
            <Text style={styles.signOutButtonText}>{signingOut ? 'Signing Out…' : 'Sign Out'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.signInButton, SHADOWS.card]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Auth')}
          >
            <Ionicons name="log-in-outline" size={16} color={COLORS.textDark} />
            <Text style={styles.signInButtonText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        )}

        {/* 2x2 High-Impact Bankroll Vault Grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>LIFETIME VAULT STATS</Text>
          <TouchableOpacity
            onPress={() => updatePreferences && updatePreferences({ privacyMode: !privacyMode })}
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
              <Ionicons name="flame-outline" size={moderateScale(15)} color={COLORS.icon} />
            </View>
            <Text style={[styles.gridCardValue, { color: COLORS.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              {privacyMode ? '••••••' : `${currencySymbol}${stats.totalWagered.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
            <Text style={styles.gridCardFoot}>Lifetime volume</Text>
          </View>

          {/* Card 3: Win Rate */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <View style={styles.gridCardTop}>
              <Text style={styles.gridCardLabel}>WIN RATE</Text>
              <Ionicons name="trophy-outline" size={moderateScale(15)} color={COLORS.icon} />
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
              <Ionicons name="layers-outline" size={moderateScale(15)} color={COLORS.icon} />
            </View>
            <Text style={[styles.gridCardValue, { color: COLORS.textPrimary }]}>
              {stats.totalHands}
            </Text>
            <Text style={styles.gridCardFoot}>Hands & tickets</Text>
          </View>
        </View>

        {/* Section 0: Ante+ */}
        <Text style={styles.sectionTitle}>{PLUS_NAME.toUpperCase()}</Text>
        <View style={[styles.menuCard, styles.proMenuCard, SHADOWS.card]}>
          <View style={styles.menuRow}>
            <View style={styles.proIconCircle}>
              <Ionicons
                name={isPro ? 'checkmark-circle' : 'sparkles'}
                size={moderateScale(18)}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>
                {isPro ? `${PLUS_NAME} Active` : `Unlock ${PLUS_NAME}`}
              </Text>
              <Text style={styles.menuSubtitle}>
                {isPro
                  ? proPlanLabel || 'Every behavioral insights page is unlocked'
                  : `Leak detection, streaks, and every insights page — unlocked with ${PLUS_NAME}`}
              </Text>
            </View>
            {purchasesLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          {isPro ? (
            <TouchableOpacity
              style={styles.proActionBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ManageSubscription')}
            >
              <Ionicons name="settings-outline" size={16} color={COLORS.textDark} style={{ marginRight: 6 }} />
              <Text style={styles.proActionBtnText}>Manage Subscription</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.proActionBtn}
              activeOpacity={0.85}
              onPress={handleUpgradePress}
            >
              <Ionicons name="sparkles" size={16} color={COLORS.textDark} style={{ marginRight: 6 }} />
              <Text style={styles.proActionBtnText}>See Plans</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Section 1: Gameplay Preferences */}
        <Text style={styles.sectionTitle}>GAMEPLAY & PREFERENCES</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          {/* Quick Chips Toggle */}
          <View style={styles.menuRow}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="flash-outline" size={moderateScale(18)} color={COLORS.icon} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Quick Chip Buttons</Text>
              <Text style={styles.menuSubtitle}>Fast cumulative chip buttons during betting</Text>
            </View>
            <Toggle
              value={quickChipsEnabled}
              onValueChange={setQuickChipsEnabled}
              accessibilityLabel="Quick chip buttons"
            />
          </View>

          <View style={styles.menuDivider} />

          {/* Quick Chip Presets */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleOpenChipPresetModal}
          >
            <View style={styles.menuIconCircle}>
              <MaterialCommunityIcons name="poker-chip" size={moderateScale(18)} color={COLORS.icon} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Quick Chip Presets</Text>
              <Text style={styles.menuSubtitle}>
                Set the chip amounts for Blackjack, Poker & Sports
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Currency Selector */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => setCurrencyModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="globe-outline" size={moderateScale(18)} color={COLORS.icon} />
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
              <Ionicons name="eye-off-outline" size={moderateScale(18)} color={COLORS.icon} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Privacy Mode</Text>
              <Text style={styles.menuSubtitle}>Mask balances with bullets across cards</Text>
            </View>
            <Toggle
              value={privacyMode}
              onValueChange={(val) => updatePreferences && updatePreferences({ privacyMode: val })}
              accessibilityLabel="Privacy mode"
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
            onPress={handleOpenLimitsModal}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons
                name={stopLossAlert ? 'shield-checkmark' : 'shield-outline'}
                size={moderateScale(18)}
                color={COLORS.danger}
              />
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
              <Ionicons name="key-outline" size={moderateScale(18)} color={COLORS.icon} />
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
        </View>

        {/* Section 4: Legal */}
        <Text style={styles.sectionTitle}>LEGAL</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="lock-closed-outline" size={moderateScale(18)} color={COLORS.icon} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Privacy Policy</Text>
              <Text style={styles.menuSubtitle}>What Ante stores and how it's controlled</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="document-text-outline" size={moderateScale(18)} color={COLORS.icon} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Terms of Service</Text>
              <Text style={styles.menuSubtitle}>Rules for using the app</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
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
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalSheet, SHADOWS.card]}
            >
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
                const isSelected = currency ? currency.startsWith(item.id) : currencySymbol === item.symbol;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.currencyOption,
                      isSelected && styles.currencyOptionSelected,
                    ]}
                    onPress={() => {
                      if (updatePreferences) {
                        updatePreferences({
                          currency: `${item.id} (${item.symbol})`,
                          currencySymbol: item.symbol,
                        });
                      }
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
            </TouchableOpacity>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={() => setLimitsModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={[styles.modalSheet, SHADOWS.card]}
              >
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
                    <Toggle
                      value={tempStopLossAlert}
                      onValueChange={setTempStopLossAlert}
                      accessibilityLabel="Session stop-loss alert"
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

                <TouchableOpacity
                  style={styles.saveModalBtn}
                  activeOpacity={0.85}
                  onPress={handleSaveLimits}
                >
                  <Text style={styles.saveModalBtnText}>Save Limits</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalSheet, SHADOWS.card]}
            >
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
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* QUICK CHIP PRESET MODAL */}
      <Modal
        visible={chipPresetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChipPresetModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={() => setChipPresetModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={[styles.modalSheet, SHADOWS.card]}
              >
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Quick Chip Presets</Text>
                  <TouchableOpacity
                    onPress={() => setChipPresetModalVisible(false)}
                    hitSlop={TOUCH_TARGET.hitSlop}
                  >
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.chipGameRow}>
                  {CHIP_PRESET_GAMES.map((g) => {
                    const isSelected = chipPresetGame === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.chipGameBtn, isSelected && styles.chipGameBtnActive]}
                        activeOpacity={0.7}
                        onPress={() => loadChipDraft(g.id)}
                      >
                        <Text style={[styles.chipGameBtnText, isSelected && styles.chipGameBtnTextActive]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.limitSub}>
                  These amounts appear as tap-to-add chip buttons while you log bets.
                  {chipPresetGame === 'poker'
                    ? ' Poker also pre-fills these at session setup.'
                    : ''}
                </Text>

                <View style={styles.chipPresetGrid}>
                  {tempChips.map((chip, idx) => (
                    <View key={idx} style={styles.chipPresetBox}>
                      <Text style={styles.chipPresetLabel}>Chip {idx + 1}</Text>
                      <View style={styles.chipPresetInputWrap}>
                        <Text style={styles.chipPresetPrefix}>{currencySymbol}</Text>
                        <TextInput
                          style={styles.chipPresetInput}
                          keyboardType="numeric"
                          value={chip}
                          placeholder="0"
                          placeholderTextColor={COLORS.textMuted}
                          onChangeText={(val) => {
                            setTempChips((prev) => {
                              const next = [...prev];
                              next[idx] = val;
                              return next;
                            });
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.saveModalBtn}
                  activeOpacity={0.85}
                  onPress={handleSaveChipPreset}
                >
                  <Text style={styles.saveModalBtnText}>Save Preset</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
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
    width: moderateScale(54),
    height: moderateScale(54),
    borderRadius: moderateScale(27),
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
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  userHandle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    marginBottom: SPACING.lg,
  },
  signInButtonText: {
    color: COLORS.textDark,
    fontWeight: '700',
    fontSize: fluidFont(14),
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: moderateScale(13),
    marginBottom: SPACING.lg,
  },
  signOutButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: fluidFont(14),
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
    fontWeight: '700',
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
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  gridCardValue: {
    fontSize: fluidFont(20),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  gridCardFoot: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 4,
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
  proMenuCard: {
    borderColor: COLORS.primaryGlow,
    paddingBottom: SPACING.sm,
  },
  proIconCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
  },
  proActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    marginBottom: SPACING.sm,
  },
  proActionBtnText: {
    color: COLORS.textDark,
    fontWeight: '700',
    fontSize: fluidFont(14),
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
    color: COLORS.accentCyan,
    marginTop: 6,
    letterSpacing: 0.5,
  },

  // Quick Chip Preset modal
  chipGameRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  chipGameBtn: {
    flex: 1,
    paddingVertical: moderateScale(9),
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipGameBtnActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  chipGameBtnText: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chipGameBtnTextActive: {
    color: COLORS.primary,
  },
  chipPresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  chipPresetBox: {
    width: '31%',
  },
  chipPresetLabel: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  chipPresetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: moderateScale(8),
    height: moderateScale(42),
  },
  chipPresetPrefix: {
    fontSize: fluidFont(13),
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 3,
  },
  chipPresetInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: fluidFont(14),
    fontWeight: '700',
    padding: 0,
  },
});
