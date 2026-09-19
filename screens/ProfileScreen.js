import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { hapticSuccess } from '../utils/haptics';
import { COLORS, SHADOWS } from '../constants/theme';
import { styles } from './profileScreenStyles';
import { screenStyles } from '../constants/screenStyles';
import { moderateScale, SPACING, TOUCH_TARGET } from '../constants/layout';
import { PLUS_NAME } from '../constants/brand';
import Toggle from '../components/Toggle';
import CountUp from '../components/CountUp';
import ReorderableGameList from '../components/ReorderableGameList';
import { useVisibleSessionHistory, useSyncStatus } from '../context/SyncContext';
import { usePreferences, DEFAULT_QUICK_CHIP_PRESETS } from '../context/PreferencesContext';
import { DEFAULT_GAME_ORDER, sanitizeGameOrder } from '../constants/games';
import { useAuth } from '../context/AuthContext';
import { usePurchases } from '../context/PurchasesContext';
import ConfirmModal from '../components/ConfirmModal';
import { ANTE_PRO_ENTITLEMENT_ID } from '../services/purchasesService';
import { formatAmount, formatMoney, relativeTime, netTone } from '../utils/format';
import { tallyHands, winRateOf } from '../utils/sessionTally';

// Ordered by how likely they are to be picked rather than alphabetically, so
// the common four stay at the top of a long list. Dollar-family currencies
// that are written as a bare "$" locally keep it; the ones conventionally
// disambiguated (HK$, S$, R$) use their real prefix. The code and full name
// in each row are what actually tell them apart.
const CURRENCY_OPTIONS = [
  { id: 'USD', name: 'US Dollar', symbol: '$' },
  { id: 'EUR', name: 'Euro', symbol: '€' },
  { id: 'GBP', name: 'British Pound', symbol: '£' },
  { id: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { id: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { id: 'NZD', name: 'New Zealand Dollar', symbol: '$' },
  { id: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { id: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { id: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { id: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { id: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { id: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { id: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { id: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { id: 'THB', name: 'Thai Baht', symbol: '฿' },
  { id: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { id: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { id: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { id: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { id: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { id: 'ARS', name: 'Argentine Peso', symbol: '$' },
  { id: 'CLP', name: 'Chilean Peso', symbol: '$' },
  { id: 'COP', name: 'Colombian Peso', symbol: '$' },
  { id: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
  { id: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { id: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { id: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { id: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
  { id: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { id: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { id: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { id: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { id: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { id: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { id: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { id: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { id: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { id: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
];

const SUPPORT_EMAIL = 'tncante1008@gmail.com';


const CHIP_PRESET_GAMES = [
  { id: 'blackjack', label: 'Blackjack', count: 5 },
  { id: 'poker', label: 'Poker', count: 6 },
  { id: 'sports', label: 'Sports', count: 5 },
  { id: 'roulette', label: 'Roulette', count: 5 },
  { id: 'baccarat', label: 'Baccarat', count: 5 },
];

// What the sync row says, per state. Kept beside the row rather than inline
// so the copy for a failure reads as one deliberate sentence: it has to admit
// something went wrong without implying the user lost anything, because they
// haven't — everything is on the device either way.
function syncRowCopy({ state, lastSyncedAt, error }) {
  switch (state) {
    case 'syncing':
      return { icon: 'sync-outline', tone: 'muted', title: 'Cloud Sync', subtitle: 'Syncing…' };
    case 'synced':
      return {
        icon: 'cloud-done-outline',
        tone: 'ok',
        title: 'Cloud Sync',
        subtitle: lastSyncedAt ? `Last synced ${relativeTime(lastSyncedAt)}` : 'Up to date',
      };
    case 'error':
      return {
        icon: 'cloud-offline-outline',
        tone: 'bad',
        title: 'Cloud Sync',
        subtitle: `Couldn't sync — will retry. Your sessions are safe on this device.${error ? ` (${error})` : ''}`,
      };
    default:
      return { icon: 'cloud-outline', tone: 'muted', title: 'Cloud Sync', subtitle: 'Waiting to sync' };
  }
}

export default function ProfileScreen({ navigation }) {
  const { sessionHistory } = useVisibleSessionHistory();
  const syncStatus = useSyncStatus();
  const { user, profile, signOut } = useAuth();
  const {
    isPro,
    isLoading: purchasesLoading,
    customerInfo,
    restorePurchases,
  } = usePurchases();
  const insets = useSafeAreaInsets();
  const {
    quickChipsEnabled = true,
    setQuickChipsEnabled,
    currencySymbol = '$',
    currency = 'USD ($)',
    privacyMode = false,
    hapticsEnabled = true,
    stopLossAlert = false,
    stopLossAmount = 250,
    updatePreferences,
    quickChipPresets = DEFAULT_QUICK_CHIP_PRESETS,
    setQuickChipPreset,
    gameOrder = DEFAULT_GAME_ORDER,
  } = usePreferences();

  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [limitsModalVisible, setLimitsModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [chipPresetModalVisible, setChipPresetModalVisible] = useState(false);
  const [chipPresetGame, setChipPresetGame] = useState('blackjack');
  const [tempChips, setTempChips] = useState([]);
  const [gameOrderModalVisible, setGameOrderModalVisible] = useState(false);

  // Temporary local state for modal controls
  const [tempStopLossAlert, setTempStopLossAlert] = useState(stopLossAlert);
  const [tempLossLimit, setTempLossLimit] = useState(String(stopLossAmount));
  const [signingOut, setSigningOut] = useState(false);

  // Account settings — 'username' | 'password' | 'delete' | null
  // Typed-back email address that arms the delete button.
  // Google-only accounts prove identity with an emailed code instead.

  const [restoring, setRestoring] = useState(false);
  // For this screen's own flows only — restore, sign-out, feedback. The
  // account and data dialogs went with their screens.
  const [profileModal, setProfileModal] = useState(null);
  const [notice, setNotice] = useState(null);

  const flashNotice = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 2600);
  };











  const activeProEntitlement = customerInfo?.entitlements?.active?.[ANTE_PRO_ENTITLEMENT_ID];
  const proPlanLabel = activeProEntitlement
    ? activeProEntitlement.expirationDate
      ? activeProEntitlement.willRenew
        ? `Renews ${new Date(activeProEntitlement.expirationDate).toLocaleDateString()}`
        : `Expires ${new Date(activeProEntitlement.expirationDate).toLocaleDateString()}`
      : 'Lifetime access'
    : null;

  const handleUpgradePress = () => {
    navigation.navigate('AntePlus');
  };

  // Apple requires a visible restore path for any app selling subscriptions,
  // and it's the only way back for someone reinstalling or on a new device.
  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (!result.success) {
        setProfileModal({
          variant: 'warning',
          icon: 'alert-circle-outline',
          title: "Couldn't restore",
          message:
            "We couldn't reach the store to check for previous purchases. Check your connection and try again.",
          confirmText: 'Got It',
          showCancel: false,
          onConfirm: () => setProfileModal(null),
        });
      } else {
        flashNotice(
          result.isPro ? `${PLUS_NAME} restored.` : 'No previous purchases found on this account.'
        );
      }
    } finally {
      setRestoring(false);
    }
  };



  const handleSendFeedback = () => {
    const body = `\n\n---\nAnte v1.0.0 · ${Platform.OS}\n`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ante feedback')}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {
      flashNotice(`Reach us at ${SUPPORT_EMAIL}`);
    });
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


  // --- Dynamic Financial & Volume Calculations ---
  const stats = useMemo(() => {
    let totalNet = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalWagered = 0;
    let totalBetsCount = 0;

    sessionHistory.forEach((session) => {
      totalNet += session.netProfit || 0;
      totalWins += session.wins || 0;
      totalLosses += session.losses || 0;

      if (session.mode === 'hands' && Array.isArray(session.hands)) {
        // One pass for both figures — tallyHands already sums the money at
        // risk, doubles included, while it counts the hands.
        const tally = tallyHands(session.hands);
        totalWagered += tally.wagered;
        totalBetsCount += tally.count;
      } else {
        // A buy-in/cash-out session has no per-hand stakes, so the buy-in is
        // the amount at risk — or, absent one, the size of the result.
        totalWagered += session.buyIn || Math.abs(session.netProfit || 0);
        totalBetsCount += 1;
      }
    });

    return {
      totalSessions: sessionHistory.length,
      totalNet,
      totalWagered,
      winRate: winRateOf(totalWins, totalLosses).toFixed(1),
      totalHands: totalBetsCount,
    };
  }, [sessionHistory]);


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

  // Called once a drag settles into its final slot — saves immediately,
  // same as every other live preference here, since the Start Session sheet
  // just reads whatever's saved the next time it opens. The drag itself
  // already ticks on pickup and on every swap, so this doesn't add another
  // haptic on top.
  const handleGameOrderChange = (next) => {
    updatePreferences?.({ gameOrder: next });
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={screenStyles.container}
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
              <Text style={styles.userName}>
                {user ? profile?.username || user?.email?.split('@')[0] || 'Player' : 'Guest'}
              </Text>
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

          <View style={styles.menuDivider} />

          {/* Required by Apple for any app selling subscriptions, and the only
              way back for someone reinstalling or on a new device. */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={handleRestore}
            disabled={restoring}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="refresh-outline" size={moderateScale(18)} color={COLORS.icon} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Restore Purchases</Text>
              <Text style={styles.menuSubtitle}>
                Already subscribed? Bring it back on this device
              </Text>
            </View>
            {restoring ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Section: Account (signed-in only) */}
        {!!user && (
          <>
            <Text style={styles.sectionTitle}>ACCOUNT</Text>
            <View style={[styles.menuCard, SHADOWS.card]}>
              {/* Cloud sync state. Every failure path in syncService ends at
                  console.error, so without this the app looked identical
                  whether pushes were succeeding or failing every time. */}
              {(() => {
                const copy = syncRowCopy(syncStatus);
                const tone =
                  copy.tone === 'ok'
                    ? COLORS.success
                    : copy.tone === 'bad'
                    ? COLORS.danger
                    : COLORS.icon;
                return (
                  <>
                    <View style={styles.menuRow}>
                      <View style={styles.menuIconCircle}>
                        <Ionicons name={copy.icon} size={moderateScale(18)} color={tone} />
                      </View>
                      <View style={styles.menuTextGroup}>
                        <Text style={styles.menuTitle}>{copy.title}</Text>
                        <Text style={styles.menuSubtitle}>{copy.subtitle}</Text>
                      </View>
                    </View>
                    <View style={styles.menuDivider} />
                  </>
                );
              })()}

              <TouchableOpacity
                style={styles.menuRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Account')}
              >
                <View style={[styles.menuIconCircle]}>
                  <Ionicons name="person-circle-outline" size={moderateScale(18)} color={COLORS.accentCyan} />
                </View>
                <View style={styles.menuTextGroup}>
                  <Text style={styles.menuTitle}>Account</Text>
                  <Text style={styles.menuSubtitle}>Username, password, and deleting your account</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {!!notice && (
              <View style={styles.noticeRow}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}
          </>
        )}

        {/* 2x2 High-Impact Bankroll Vault Grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>LIFETIME VAULT STATS</Text>
          <TouchableOpacity
            onPress={() => updatePreferences && updatePreferences({ privacyMode: !privacyMode })}
            hitSlop={TOUCH_TARGET.hitSlop}
            style={styles.privacyToggleBtn}
            accessibilityRole="switch"
            accessibilityState={{ checked: privacyMode }}
            accessibilityLabel="Hide amounts app-wide"
          >
            <Ionicons
              name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
              size={moderateScale(16)}
              color={COLORS.textSecondary}
            />
            <Text style={styles.privacyToggleText}>
              {privacyMode ? 'Amounts hidden' : 'Hide amounts'}
            </Text>
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
            <CountUp
              value={stats.totalNet}
              format={(v) => formatMoney(v, currencySymbol, privacyMode)}
              animate={!privacyMode}
              style={[
                styles.gridCardValue,
                {
                  color: netTone(stats.totalNet, privacyMode),
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            <Text style={styles.gridCardFoot}>
              {stats.totalNet >= 0 ? 'Profit realized' : 'Total variance'}
            </Text>
          </View>

          {/* Card 2: Total Lifetime Wagered */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <View style={styles.gridCardTop}>
              <Text style={styles.gridCardLabel}>TOTAL WAGERED</Text>
              <Ionicons name="flame-outline" size={moderateScale(15)} color={COLORS.accentOrange} />
            </View>
            <Text style={[styles.gridCardValue, { color: COLORS.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(stats.totalWagered, currencySymbol, privacyMode, { signed: false })}
            </Text>
            <Text style={styles.gridCardFoot}>Lifetime volume</Text>
          </View>

          {/* Card 3: Win Rate */}
          <View style={[styles.gridCard, SHADOWS.card]}>
            <View style={styles.gridCardTop}>
              <Text style={styles.gridCardLabel}>WIN RATE</Text>
              <Ionicons name="trophy-outline" size={moderateScale(15)} color={COLORS.warning} />
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
              <Ionicons name="layers-outline" size={moderateScale(15)} color={COLORS.accentCyan} />
            </View>
            <Text style={[styles.gridCardValue, { color: COLORS.textPrimary }]}>
              {stats.totalHands}
            </Text>
            <Text style={styles.gridCardFoot}>Hands & tickets</Text>
          </View>
        </View>

        {/* Section 1: Gameplay Preferences */}
        <Text style={styles.sectionTitle}>GAMEPLAY & PREFERENCES</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          {/* Quick Chips Toggle */}
          <View style={styles.menuRow}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="flash-outline" size={moderateScale(18)} color={COLORS.warning} />
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

          <View style={styles.menuRow}>
            <View style={styles.menuIconCircle}>
              <Ionicons
                name="phone-portrait-outline"
                size={moderateScale(18)}
                color={COLORS.icon}
              />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Haptic Feedback</Text>
              <Text style={styles.menuSubtitle}>Vibration on taps, wins, and session actions</Text>
            </View>
            <Toggle
              value={hapticsEnabled}
              onValueChange={(val) => {
                updatePreferences?.({ hapticsEnabled: val });
                // Fire a deliberately strong buzz when switching on, so the
                // setting proves itself. Deferred a tick because the value
                // reaches utils/haptics through an effect, which hasn't run
                // yet at this point. If nothing is felt here, haptics are off
                // at the OS level rather than in the app.
                if (val) setTimeout(hapticSuccess, 0);
              }}
              accessibilityLabel="Haptic feedback"
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
              <MaterialCommunityIcons name="poker-chip" size={moderateScale(18)} color={COLORS.accentOrange} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Quick Chip Presets</Text>
              <Text style={styles.menuSubtitle}>
                Set the chip amounts per game
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Game Order */}
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => setGameOrderModalVisible(true)}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="reorder-three-outline" size={moderateScale(18)} color={COLORS.accentCyan} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Game Order</Text>
              <Text style={styles.menuSubtitle}>
                Choose which games lead the Start Session sheet
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
              <Ionicons name="globe-outline" size={moderateScale(18)} color={COLORS.success} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Display Currency</Text>
              <Text style={styles.menuSubtitle}>Currently formatted in {currency}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Privacy Mode Toggle */}
          <View style={styles.menuRow}>
            <View style={styles.menuIconCircle}>
              <Ionicons
                name={privacyMode ? 'eye-off-outline' : 'eye-outline'}
                size={moderateScale(18)}
                color={privacyMode ? COLORS.accentCyan : COLORS.icon}
              />
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
                {stopLossAlert ? `Active warning at ${currencySymbol}${formatAmount(stopLossAmount)}` : 'No threshold configured'}
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

        {/* Section 3: Security & Data Vault. The flows themselves live on
            their own screen — erasing everything and exporting your history
            are not settings rows, and they were sharing this screen's state
            bag with the haptics toggle. */}
        <Text style={styles.sectionTitle}>DATA VAULT & SECURITY</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          <TouchableOpacity
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('DataPrivacy')}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="shield-checkmark-outline" size={moderateScale(18)} color={COLORS.accentCyan} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Data & Privacy</Text>
              <Text style={styles.menuSubtitle}>Hide amounts, export your history, erase everything</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Section: Support */}
        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <View style={[styles.menuCard, SHADOWS.card]}>
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={handleSendFeedback}>
            <View style={styles.menuIconCircle}>
              <Ionicons name="mail-outline" size={moderateScale(18)} color={COLORS.accentViolet} />
            </View>
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Send Feedback</Text>
              <Text style={styles.menuSubtitle}>Report a bug or ask for a feature</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
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
              <Ionicons name="lock-closed-outline" size={moderateScale(18)} color={COLORS.success} />
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
              <Ionicons name="document-text-outline" size={moderateScale(18)} color={COLORS.info} />
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

      <ConfirmModal visible={!!profileModal} {...profileModal} />

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

              {/* Long enough now that it has to scroll inside the sheet
                  rather than pushing it off the screen. */}
              <ScrollView
                style={styles.currencyList}
                contentContainerStyle={styles.currencyListContent}
                showsVerticalScrollIndicator={false}
              >
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
              </ScrollView>
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

      {/* GAME ORDER MODAL — press and drag a row by its handle to reorder.
          Remounted fresh each time it opens (the `visible &&` below, not
          just Modal's own `visible` prop) so its internal drag state — and
          the order it seeds from — starts from whatever's actually saved,
          rather than whatever gameOrder happened to be the first time this
          screen ever mounted. */}
      <Modal
        visible={gameOrderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGameOrderModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setGameOrderModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalSheet, SHADOWS.card]}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Game Order</Text>
                <TouchableOpacity
                  onPress={() => setGameOrderModalVisible(false)}
                  hitSlop={TOUCH_TARGET.hitSlop}
                >
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.limitSub}>
                Press and drag a row by its handle to set the order game cards
                appear in on the Start Session sheet.
              </Text>

              {gameOrderModalVisible && (
                <ReorderableGameList
                  initialOrder={sanitizeGameOrder(gameOrder)}
                  onChange={handleGameOrderChange}
                />
              )}

              <TouchableOpacity
                style={[styles.saveModalBtn, { marginTop: SPACING.md }]}
                activeOpacity={0.85}
                onPress={() => setGameOrderModalVisible(false)}
              >
                <Text style={styles.saveModalBtnText}>Done</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
