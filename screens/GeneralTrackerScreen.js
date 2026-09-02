import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useActiveSession } from '../context/SessionContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import GuestModeBanner from '../components/GuestModeBanner';
import LivePulseDot from '../components/LivePulseDot';

export default function GeneralTrackerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currencySymbol = '$' } = usePreferences();
  const { user } = useAuth();
  const {
    activeSession,
    startSession,
    endActiveSession,
    discardActiveSession,
    setSessionBuyInCashOut,
  } = useActiveSession();

  useEffect(() => {
    if (!activeSession) {
      startSession('General');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [buyIn, setBuyIn] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [label, setLabel] = useState('');
  const [alertModal, setAlertModal] = useState(null);
  const closeAlertModal = () => setAlertModal(null);

  const parsedBuyIn = parseFloat(buyIn);
  const parsedCashOut = parseFloat(cashOut);
  const hasValidNumbers =
    buyIn !== '' &&
    cashOut !== '' &&
    !isNaN(parsedBuyIn) &&
    !isNaN(parsedCashOut) &&
    parsedBuyIn >= 0 &&
    parsedCashOut >= 0;

  useEffect(() => {
    if (activeSession && setSessionBuyInCashOut) {
      const b = !isNaN(parsedBuyIn) && parsedBuyIn >= 0 ? parsedBuyIn : null;
      const c = !isNaN(parsedCashOut) && parsedCashOut >= 0 ? parsedCashOut : null;
      setSessionBuyInCashOut(b, c);
    }
  }, [parsedBuyIn, parsedCashOut, activeSession?.id]);

  const liveNet = hasValidNumbers ? parsedCashOut - parsedBuyIn : 0;

  const handleEndSessionPress = () => {
    if (!hasValidNumbers) {
      setAlertModal({
        variant: 'warning',
        title: 'Enter Buy-In and Cash-Out',
        message: 'You need to enter both amounts before ending this session.',
        confirmText: 'Got It',
        showCancel: false,
        onConfirm: closeAlertModal,
      });
      return;
    }
    endActiveSession(parsedBuyIn, parsedCashOut);
    navigation.navigate('MainTabs', { screen: 'History' });
  };

  const handleDiscardPress = () => {
    setAlertModal({
      variant: 'danger',
      icon: 'trash-outline',
      title: 'Discard This Session?',
      message: 'Nothing has been saved yet. This cannot be undone.',
      confirmText: 'Discard',
      cancelText: 'Cancel',
      onConfirm: () => {
        closeAlertModal();
        discardActiveSession();
        navigation.navigate('MainTabs', { screen: 'Home' });
      },
      onCancel: closeAlertModal,
    });
  };

  // useFocusEffect (not useEffect) so this handler is removed while the screen
  // is blurred — otherwise a paused session left in the stack keeps grabbing
  // the Android back gesture from other screens and pops its discard modal.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleDiscardPress();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasValidNumbers, parsedBuyIn, parsedCashOut])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backBtn} onPress={handleDiscardPress}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <LivePulseDot size={8} color={COLORS.danger} />
          <Text style={styles.navTitle}>General Tracker</Text>
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

        <View style={[styles.statsBox, SHADOWS.card]}>
          <Text style={styles.statsSubtext}>PROJECTED NET OUTCOME</Text>
          <Text
            style={[
              styles.netAmount,
              {
                color: !hasValidNumbers
                  ? COLORS.textPrimary
                  : liveNet > 0
                  ? COLORS.success
                  : liveNet < 0
                  ? COLORS.danger
                  : COLORS.textPrimary,
              },
            ]}
          >
            {hasValidNumbers ? `${liveNet > 0 ? '+' : liveNet < 0 ? '-' : ''}${currencySymbol}${Math.abs(liveNet).toFixed(2)}` : '—'}
          </Text>
          <Text style={styles.statsHint}>
            For slots, craps, roulette, or anything you'd rather log simply
          </Text>
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.label}>What are you tracking? (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Slots, Roulette, Craps"
            placeholderTextColor={COLORS.textMuted}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.label}>Buy-In ({currencySymbol})</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 100"
            placeholderTextColor={COLORS.textMuted}
            value={buyIn}
            onChangeText={setBuyIn}
          />

          <Text style={styles.label}>Cash-Out ({currencySymbol})</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 80"
            placeholderTextColor={COLORS.textMuted}
            value={cashOut}
            onChangeText={setCashOut}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, !hasValidNumbers && styles.submitDisabled]}
          onPress={handleEndSessionPress}
          disabled={!hasValidNumbers}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>End Session & Save to History</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal visible={!!alertModal} {...alertModal} />
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
    borderColor: COLORS.dangerBorder,
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
  netAmount: { fontSize: 34, fontWeight: '700', marginBottom: 8 },
  statsHint: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
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
    fontSize: 18,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitDisabled: { backgroundColor: COLORS.cardBorder, opacity: 0.5 },
  submitText: { color: COLORS.textDark, fontWeight: '700', fontSize: 15 },
});
