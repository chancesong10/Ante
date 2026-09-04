import React, { useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RevenueCatUI from 'react-native-purchases-ui';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { PLUS_NAME } from '../constants/brand';
import { useAuth } from '../context/AuthContext';
import { usePurchases } from '../context/PurchasesContext';

// Hosts RevenueCat's paywall inside our own screen rather than calling
// presentPaywall(), which opens a native modal we can't put anything on top
// of. Embedding it means the back arrow below is ours: it always works, even
// if the paywall fails to load or the dashboard's own close button is off,
// so there's no way to get stranded in here.
export default function AntePlusScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshCustomerInfo } = usePurchases();

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'Profile' });
  }, [navigation]);

  const handleFinished = useCallback(async () => {
    await refreshCustomerInfo();
    goBack();
  }, [refreshCustomerInfo, goBack]);

  const BackButton = (
    <TouchableOpacity
      style={[styles.backBtn, { top: insets.top + moderateScale(10) }]}
      onPress={goBack}
      activeOpacity={0.8}
      hitSlop={TOUCH_TARGET.hitSlop}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={moderateScale(22)} color={COLORS.textPrimary} />
    </TouchableOpacity>
  );

  // A subscription is tied to an account, so buying while signed out would
  // strand it on an anonymous id that can't follow the user to a new phone.
  if (!user) {
    return (
      <View style={styles.gate}>
        {BackButton}
        <View style={[styles.gateCard, SHADOWS.card]}>
          <View style={styles.gateIcon}>
            <Ionicons name="sparkles" size={moderateScale(22)} color={COLORS.primary} />
          </View>
          <Text style={styles.gateTitle}>Sign in to unlock {PLUS_NAME}</Text>
          <Text style={styles.gateBody}>
            Your subscription is tied to your account, so it follows you to a new phone and
            restores in one tap. Create an account or sign in to continue.
          </Text>
          <TouchableOpacity
            style={styles.gateBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Auth')}
            accessibilityRole="button"
            accessibilityLabel="Sign in or create an account"
          >
            <Ionicons
              name="log-in-outline"
              size={moderateScale(16)}
              color={COLORS.textDark}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.gateBtnText}>Sign In / Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={styles.gateLink}>
            <Text style={styles.gateLinkText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RevenueCatUI.Paywall
        style={StyleSheet.absoluteFill}
        options={{ displayCloseButton: false }}
        onPurchaseCompleted={handleFinished}
        onRestoreCompleted={handleFinished}
        onDismiss={goBack}
      />
      {BackButton}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Floats over the paywall. The scrim keeps it legible whatever artwork the
  // dashboard puts behind it.
  backBtn: {
    position: 'absolute',
    left: SPACING.pageHorizontal,
    zIndex: 10,
    elevation: 10,
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.6)',
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
  },

  gate: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
  },
  gateCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    padding: SPACING.cardPadding,
    alignItems: 'center',
  },
  gateIcon: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  gateTitle: {
    fontSize: fluidFont(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  gateBody: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: fluidFont(19),
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  gateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    minHeight: TOUCH_TARGET.minSize,
  },
  gateBtnText: {
    color: COLORS.textDark,
    fontWeight: '700',
    fontSize: fluidFont(14),
  },
  gateLink: { paddingVertical: SPACING.sm, marginTop: 2 },
  gateLinkText: {
    fontSize: fluidFont(13),
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
