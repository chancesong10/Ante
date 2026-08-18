import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { useSession } from '../context/SessionContext';

export default function PokerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    activeSession,
    startSession,
    setSessionBuyInCashOut,
    endActiveSession,
    discardActiveSession,
  } = useSession();

  useEffect(() => {
    if (!activeSession) {
      startSession('Poker');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [buyIn, setBuyIn] = useState('');
  const [cashOut, setCashOut] = useState('');

  const parsedBuyIn = parseFloat(buyIn);
  const parsedCashOut = parseFloat(cashOut);
  const hasValidNumbers =
    buyIn !== '' && cashOut !== '' && !isNaN(parsedBuyIn) && !isNaN(parsedCashOut) && parsedBuyIn >= 0 && parsedCashOut >= 0;

  const liveNet = hasValidNumbers ? parsedCashOut - parsedBuyIn : 0;

  const handleEndSessionPress = () => {
    if (!hasValidNumbers) {
      Alert.alert(
        'Enter Buy-In and Cash-Out',
        'You need to enter both amounts before ending this session.'
      );
      return;
    }

    setSessionBuyInCashOut(parsedBuyIn, parsedCashOut);
    endActiveSession();
    navigation.navigate('MainTabs', { screen: 'History' });
  };

  const handleDiscardPress = () => {
    Alert.alert(
      'Discard this session?',
      'Nothing has been saved yet. This cannot be undone.',
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <View style={[styles.statsBox, SHADOWS.card]}>
          <Text style={styles.statsSubtext}>PROJECTED NET OUTCOME</Text>
          <Text
            style={[
              styles.netAmount,
              {
                color: !hasValidNumbers
                  ? COLORS.textPrimary
                  : liveNet > 0
                  ? COLORS.primary
                  : liveNet < 0
                  ? COLORS.danger
                  : COLORS.textPrimary,
              },
            ]}
          >
            {hasValidNumbers ? `${liveNet > 0 ? '+' : ''}$${liveNet.toFixed(2)}` : '—'}
          </Text>
          <Text style={styles.statsHint}>
            Enter your buy-in and cash-out to see your result
          </Text>
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.label}>Buy-In ($)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 200"
            placeholderTextColor={COLORS.textMuted}
            value={buyIn}
            onChangeText={setBuyIn}
          />

          <Text style={styles.label}>Cash-Out ($)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 350"
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
    borderColor: 'rgba(255, 69, 58, 0.4)',
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
  netAmount: {
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  statsHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
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
  submitDisabled: {
    backgroundColor: COLORS.cardBorder,
    opacity: 0.5,
  },
  submitText: {
    color: COLORS.textDark,
    fontWeight: '800',
    fontSize: 15,
  },
});