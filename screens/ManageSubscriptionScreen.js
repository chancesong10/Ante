import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { usePurchases } from '../context/PurchasesContext';
import { ANTE_PRO_ENTITLEMENT_ID } from '../services/purchasesService';

// Where "Contact support" points — update to the real support address.
const SUPPORT_EMAIL = 'tncante1008@gmail.com';

// Friendly names for RevenueCat's `store` values on an entitlement.
const STORE_LABELS = {
  APP_STORE: 'the App Store',
  MAC_APP_STORE: 'the Mac App Store',
  PLAY_STORE: 'Google Play',
  AMAZON: 'the Amazon Appstore',
  GALAXY: 'the Galaxy Store',
  STRIPE: 'Stripe',
  PADDLE: 'Paddle',
  RC_BILLING: 'the web',
  EXTERNAL: 'an external purchase',
  PROMOTIONAL: 'a promo grant',
  TEST_STORE: 'the test store',
  UNKNOWN_STORE: null,
};

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Monthly / Annual / Lifetime for the active entitlement. Matches the
// purchased product against the offering's standard packages first (exact),
// then falls back to the length of the current billing period.
function derivePlanLabel(entitlement, packages) {
  if (!entitlement) return '—';
  if (!entitlement.expirationDate) return 'Lifetime';

  const pid = entitlement.productIdentifier;
  if (pid && packages) {
    if (pid === packages.monthly?.product?.identifier) return 'Monthly';
    if (pid === packages.yearly?.product?.identifier) return 'Annual';
    if (pid === packages.lifetime?.product?.identifier) return 'Lifetime';
  }

  const start = new Date(entitlement.latestPurchaseDate).getTime();
  const end = new Date(entitlement.expirationDate).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return (end - start) / 86400000 > 80 ? 'Annual' : 'Monthly';
  }
  return 'Subscription';
}

function DetailRow({ label, value, last }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionRow({ icon, title, subtitle, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.menuIconCircle, danger && styles.menuIconCircleDanger]}>
        <Ionicons
          name={icon}
          size={moderateScale(18)}
          color={danger ? COLORS.danger : COLORS.textPrimary}
        />
      </View>
      <View style={styles.menuTextGroup}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
        {!!subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="open-outline" size={moderateScale(16)} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

export default function ManageSubscriptionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { customerInfo, packages, presentPaywall, refreshCustomerInfo } = usePurchases();
  const [busy, setBusy] = useState(false);

  // Re-pull entitlement state whenever the screen comes back into focus, so
  // a cancellation/renewal the user just made in their store account is
  // reflected here without needing an app restart.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      refreshCustomerInfo();
    });
    return unsub;
  }, [navigation, refreshCustomerInfo]);

  const entitlement = customerInfo?.entitlements?.active?.[ANTE_PRO_ENTITLEMENT_ID];
  const managementURL = customerInfo?.managementURL;
  const isLifetime = !!entitlement && !entitlement.expirationDate;
  const planLabel = derivePlanLabel(entitlement, packages);
  const expiryDate = formatDate(entitlement?.expirationDate);
  const purchasedVia = entitlement ? STORE_LABELS[entitlement.store] : null;

  let statusText = 'No active plan';
  let statusColor = COLORS.textSecondary;
  if (entitlement) {
    if (entitlement.billingIssueDetectedAt) {
      statusText = 'Billing issue — update your payment method';
      statusColor = COLORS.danger;
    } else if (isLifetime) {
      statusText = 'Lifetime access — never expires';
      statusColor = COLORS.success;
    } else if (entitlement.willRenew) {
      statusText = expiryDate ? `Renews on ${expiryDate}` : 'Active';
      statusColor = COLORS.success;
    } else {
      statusText = expiryDate ? `Cancels on ${expiryDate}` : 'Active';
      statusColor = COLORS.warning;
    }
  }

  const handleOpenStore = useCallback(async () => {
    if (!managementURL || busy) return;
    setBusy(true);
    try {
      const ok = await Linking.canOpenURL(managementURL);
      if (ok) {
        await Linking.openURL(managementURL);
      } else {
        Alert.alert('Unavailable', "This device can't open the subscription management page.");
      }
    } catch {
      Alert.alert('Unavailable', 'Something went wrong opening the subscription management page.');
    } finally {
      setBusy(false);
    }
  }, [managementURL, busy]);

  const handleContactSupport = useCallback(() => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Ante Pro — subscription help')}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('No mail app found', `You can reach us at ${SUPPORT_EMAIL}.`);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={TOUCH_TARGET.hitSlop}
          style={styles.backIcon}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Manage Subscription</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + moderateScale(40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Membership status */}
        <Text style={styles.sectionTitle}>MEMBERSHIP</Text>
        <View style={[styles.card, styles.statusCard, SHADOWS.card]}>
          <View style={styles.statusHeaderRow}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={entitlement ? 'checkmark-circle' : 'sparkles'}
                size={moderateScale(18)}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.statusHeaderText}>
              <Text style={styles.cardTitle}>Ante Pro</Text>
              <Text style={[styles.statusLine, { color: statusColor }]}>{statusText}</Text>
            </View>
          </View>

          {entitlement ? (
            <View style={styles.detailList}>
              <DetailRow label="Plan" value={planLabel} />
              <DetailRow
                label={isLifetime || entitlement.willRenew ? 'Next renewal' : 'Access ends'}
                value={isLifetime ? 'N/A' : expiryDate || '—'}
              />
              {!!purchasedVia && <DetailRow label="Purchased via" value={purchasedVia} />}
              {!!entitlement.productIdentifier && (
                <DetailRow label="Product" value={entitlement.productIdentifier} last />
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => presentPaywall()}
            >
              <Ionicons
                name="sparkles"
                size={16}
                color={COLORS.textDark}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.primaryBtnText}>See Plans</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Manage / cancel */}
        {!!entitlement && (
          <>
            <Text style={styles.sectionTitle}>MANAGE</Text>
            <View style={[styles.card, styles.menuCard, SHADOWS.card]}>
              {isLifetime ? (
                <View style={styles.menuRow}>
                  <View style={styles.menuIconCircle}>
                    <Ionicons name="infinite" size={moderateScale(18)} color={COLORS.primary} />
                  </View>
                  <View style={styles.menuTextGroup}>
                    <Text style={styles.menuTitle}>Lifetime access</Text>
                    <Text style={styles.menuSubtitle}>
                      You own Ante Pro for good — there’s no subscription to cancel.
                    </Text>
                  </View>
                </View>
              ) : managementURL ? (
                entitlement.willRenew ? (
                  <>
                    <ActionRow
                      icon="swap-horizontal"
                      title="Change plan"
                      subtitle="Switch between monthly and annual"
                      onPress={handleOpenStore}
                    />
                    <View style={styles.menuDivider} />
                    <ActionRow
                      icon="close-circle-outline"
                      title="Cancel subscription"
                      subtitle={
                        expiryDate
                          ? `You’ll keep Pro until ${expiryDate}`
                          : 'You’ll keep Pro until the period ends'
                      }
                      onPress={handleOpenStore}
                      danger
                    />
                  </>
                ) : (
                  <ActionRow
                    icon="refresh-outline"
                    title="Manage subscription"
                    subtitle={
                      expiryDate
                        ? `Auto-renewal is off — Pro ends ${expiryDate}`
                        : 'Auto-renewal is off'
                    }
                    onPress={handleOpenStore}
                  />
                )
              ) : (
                <View style={styles.menuRow}>
                  <View style={styles.menuIconCircle}>
                    <Ionicons
                      name="information-circle-outline"
                      size={moderateScale(18)}
                      color={COLORS.textSecondary}
                    />
                  </View>
                  <View style={styles.menuTextGroup}>
                    <Text style={styles.menuTitle}>Cancel or change plan</Text>
                    <Text style={styles.menuSubtitle}>
                      Open {purchasedVia || 'your app store'} and go to Subscriptions to manage
                      Ante Pro.
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.menuDivider} />

              <ActionRow
                icon="mail-outline"
                title="Contact support"
                subtitle="Questions about billing or your plan"
                onPress={handleContactSupport}
              />
            </View>
          </>
        )}

        <Text style={styles.footnote}>
          {isLifetime
            ? 'Ante Pro lifetime access is tied to your account and the store it was bought from.'
            : 'Subscriptions renew automatically until cancelled. Turn off renewal any time from your store account — you keep Pro until the current period ends.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backIcon: { padding: 4 },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  scroll: {
    padding: SPACING.pageHorizontal,
    paddingTop: SPACING.md,
  },

  sectionTitle: {
    fontSize: fluidFont(13),
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    marginLeft: 2,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  statusCard: { padding: SPACING.cardPadding },
  menuCard: { paddingHorizontal: SPACING.cardPadding },

  statusHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  statusHeaderText: { flex: 1 },
  cardTitle: { fontSize: fluidFont(15), fontWeight: '700', color: COLORS.textPrimary },
  statusLine: { fontSize: fluidFont(12), fontWeight: '600', marginTop: 2 },

  detailList: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(11),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: SPACING.md,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: fluidFont(12.5), color: COLORS.textSecondary },
  detailValue: {
    fontSize: fluidFont(12.5),
    color: COLORS.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    marginTop: SPACING.md,
  },
  primaryBtnText: { color: COLORS.textDark, fontWeight: '700', fontSize: fluidFont(14) },

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
    backgroundColor: COLORS.dangerMuted,
    borderColor: COLORS.dangerBorder,
  },
  menuTextGroup: { flex: 1, marginRight: SPACING.xs },
  menuTitle: { fontSize: fluidFont(14), fontWeight: '700', color: COLORS.textPrimary },
  menuTitleDanger: { color: COLORS.danger },
  menuSubtitle: { fontSize: fluidFont(11), color: COLORS.textSecondary, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginLeft: moderateScale(48) },

  footnote: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    lineHeight: fluidFont(16),
    marginTop: SPACING.xs,
    marginHorizontal: 2,
  },
});
