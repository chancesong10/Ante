import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET, DEVICE } from '../constants/layout';
import { useSession } from '../context/SessionContext';
import { usePreferences } from '../context/PreferencesContext';

export default function ProfileScreen() {
  const { sessionHistory } = useSession();
  const insets = useSafeAreaInsets();
  const { quickChipsEnabled, setQuickChipsEnabled } = usePreferences();

  const totalSessions = sessionHistory.length;
  const totalNet = sessionHistory.reduce((sum, s) => sum + s.netProfit, 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingBottom: insets.bottom + moderateScale(96),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Preferences and bankroll configurations</Text>
        </View>

        {/* User / Bankroll Overview Card */}
        <View style={[styles.profileCard, SHADOWS.card]}>
          <View style={styles.avatarCircle}>
            <Ionicons
              name="person"
              size={moderateScale(28)}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.userName}>Ante Player</Text>
            <Text style={styles.userSubtitle}>
              {totalSessions} recorded {totalSessions === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>ACTIVE</Text>
          </View>
        </View>

        {/* Summary Stat Strip */}
        <View style={[styles.statRow, SHADOWS.card]}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Lifetime Net</Text>
            <Text
              style={[
                styles.statNumber,
                {
                  color:
                    totalNet > 0
                      ? COLORS.success
                      : totalNet < 0
                      ? COLORS.danger
                      : COLORS.textPrimary,
                },
              ]}
            >
              {totalNet > 0 ? '+' : ''}${totalNet.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Target Ratio</Text>
            <Text style={[styles.statNumber, { color: COLORS.primary }]}>3:2</Text>
          </View>
        </View>

        {/* Preferences Section */}
        <Text style={styles.sectionHeader}>Preferences</Text>
        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Quick Chips</Text>
              <Text style={styles.settingDesc}>Display fast $10, $25, $50 buttons when logging a bet</Text>
            </View>
            <Switch
              value={quickChipsEnabled}
              onValueChange={setQuickChipsEnabled}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.primaryMuted }}
              thumbColor={quickChipsEnabled ? COLORS.primary : '#A0A0A0'}
            />
          </View>
        </View>

        {/* Display & Fluid Device Specs Section */}
        <Text style={styles.sectionHeader}>Display & Safe Insets</Text>
        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Viewport Resolution</Text>
            <Text style={styles.specValue}>
              {Math.round(DEVICE.width)} × {Math.round(DEVICE.height)} pt
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Aspect Ratio</Text>
            <Text style={styles.specValue}>{DEVICE.aspectRatio.toFixed(2)} : 1</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Safe Area Insets (T / B / L / R)</Text>
            <Text style={styles.specValue}>
              {Math.round(insets.top)} / {Math.round(insets.bottom)} / {Math.round(insets.left)} / {Math.round(insets.right)}
            </Text>
          </View>
        </View>

        {/* App Version Info */}
        <View style={styles.footerInfo}>
          <Text style={styles.versionText}>Ante Tracker v1.0.0</Text>
          <Text style={styles.copyrightText}>Device-Agnostic Adaptive Engine</Text>
        </View>
      </ScrollView>
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
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: fluidFont(26),
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  avatarCircle: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
  },
  profileMeta: {
    flex: 1,
  },
  userName: {
    fontSize: fluidFont(17),
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  userSubtitle: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
  },
  statusBadgeText: {
    color: COLORS.primary,
    fontSize: fluidFont(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(12),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 2,
  },
  statLabel: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: fluidFont(18),
    fontWeight: '800',
  },
  sectionHeader: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: TOUCH_TARGET.minSize,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  settingTitle: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  settingDesc: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: moderateScale(10),
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(4),
  },
  specLabel: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
  },
  specValue: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    color: COLORS.primary,
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  versionText: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  copyrightText: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
