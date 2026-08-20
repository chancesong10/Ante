import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';

export default function ResponsibleGamingAlertModal({
  visible,
  netOutcome = 0,
  durationMinutes = 0,
  totalBets = 0,
  thresholdAmount = 250,
  currencySymbol = '$',
  onEndSession,
  onAcknowledge,
}) {
  if (!visible) return null;

  const formatTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onAcknowledge}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback>
          <View style={[styles.modalCard, SHADOWS.card]}>
            {/* Warning Icon Badge */}
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: COLORS.dangerMuted,
                  borderColor: 'rgba(244, 63, 94, 0.3)',
                },
              ]}
            >
              <Ionicons
                name="shield-outline"
                size={moderateScale(32)}
                color={COLORS.danger}
              />
            </View>

            {/* Alert Header */}
            <Text style={[styles.title, { color: COLORS.danger }]}>
              STOP-LOSS THRESHOLD REACHED
            </Text>
            <Text style={styles.subtitle}>
              Your live session outcome has dropped to {currencySymbol}{Math.abs(netOutcome).toFixed(2)}, crossing your {currencySymbol}{thresholdAmount} safety limit.
            </Text>

            {/* Live Metrics Grid */}
            <View style={styles.metricsBox}>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>LIVE OUTCOME</Text>
                <Text
                  style={[
                    styles.metricVal,
                    { color: netOutcome < 0 ? COLORS.danger : COLORS.success },
                  ]}
                >
                  {netOutcome < 0 ? '-' : '+'}
                  {currencySymbol}
                  {Math.abs(netOutcome).toFixed(2)}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>DURATION</Text>
                <Text style={styles.metricVal}>{formatTime(durationMinutes)}</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>LOGS</Text>
                <Text style={styles.metricVal}>{totalBets}</Text>
              </View>
            </View>

            {/* Helpline Notice */}
            <View style={styles.supportBox}>
              <Ionicons name="heart-circle-outline" size={16} color={COLORS.success} />
              <Text style={styles.supportText}>
                Need support? Call 24/7 Helpline: <Text style={styles.supportPhone}>1-800-522-4700</Text>
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.primaryEndBtn, SHADOWS.card]}
                activeOpacity={0.85}
                onPress={onEndSession}
                accessibilityRole="button"
                accessibilityLabel="End Session and Save"
              >
                <Ionicons
                  name="stop-circle-outline"
                  size={moderateScale(18)}
                  color={COLORS.textDark}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryEndBtnText}>End Session & Protect Bankroll</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                onPress={onAcknowledge}
                accessibilityRole="button"
                accessibilityLabel="Acknowledge and Continue"
              >
                <Text style={styles.secondaryBtnText}>Acknowledge & Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.pageHorizontal,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  iconBadge: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: fluidFont(17),
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: fluidFont(18),
    marginBottom: SPACING.md,
    paddingHorizontal: 8,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(8),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    width: '100%',
    marginBottom: SPACING.sm,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: COLORS.cardBorder,
    marginVertical: 2,
  },
  metricLabel: {
    fontSize: fluidFont(10),
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  supportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xs,
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    gap: 6,
    width: '100%',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  supportText: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    flex: 1,
  },
  supportPhone: {
    color: COLORS.success,
    fontWeight: '700',
  },
  buttonGroup: {
    width: '100%',
    gap: SPACING.xs,
  },
  primaryEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    minHeight: TOUCH_TARGET.minSize,
  },
  primaryEndBtnText: {
    color: COLORS.textDark,
    fontSize: fluidFont(14),
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: TOUCH_TARGET.minSize,
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(13),
    fontWeight: '700',
  },
});
