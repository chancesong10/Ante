import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, themed } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { formatAmount, formatNumber } from '../utils/format';
import { HELPLINE } from '../constants/legal';

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
      <View style={styles.overlay} accessibilityViewIsModal>
        <TouchableWithoutFeedback>
          <View style={[styles.modalCard, SHADOWS.card]}>
            {/* Warning Icon Badge */}
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: COLORS.dangerMuted,
                  borderColor: COLORS.dangerBorder,
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
              Your live session outcome has dropped to {currencySymbol}{formatNumber(Math.abs(netOutcome))}, crossing your {currencySymbol}{formatAmount(thresholdAmount)} safety limit.
            </Text>

            {/* Live Metrics Grid */}
            <View style={styles.metricsBox}>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>Live outcome</Text>
                <Text
                  style={[
                    styles.metricVal,
                    { color: netOutcome < 0 ? COLORS.danger : COLORS.success },
                  ]}
                >
                  {netOutcome < 0 ? '-' : '+'}
                  {currencySymbol}
                  {formatNumber(Math.abs(netOutcome))}
                </Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>Duration</Text>
                <Text style={styles.metricVal}>{formatTime(durationMinutes)}</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>Logs</Text>
                <Text style={styles.metricVal}>{totalBets}</Text>
              </View>
            </View>

            {/* Helpline Notice.

                Dials rather than just displaying: a number someone has to
                memorise and re-type is a number they don't call. `canOpenURL`
                is skipped deliberately — it returns false on a tablet with no
                dialler, and the catch below already covers that, whereas the
                check would silently make the row inert on devices that could
                have handed off to a paired phone.

                The second line exists because the number is US-only and the
                app is not. Showing an unreachable number to someone in
                Manchester or Melbourne, with no hint that theirs exists, is
                worse than showing nothing. */}
            <TouchableOpacity
              style={styles.supportBox}
              activeOpacity={0.7}
              onPress={() => Linking.openURL(`tel:${HELPLINE.tel}`).catch(() => {})}
              accessibilityRole="button"
              accessibilityLabel={`Call the ${HELPLINE.name} helpline on ${HELPLINE.display}`}
            >
              <Ionicons name="heart-circle-outline" size={16} color={COLORS.success} />
              <Text style={styles.supportText}>
                Need support? Call the 24/7 helpline:{' '}
                <Text style={styles.supportPhone}>{HELPLINE.display}</Text> ({HELPLINE.region})
              </Text>
            </TouchableOpacity>

            <Text style={styles.supportIntl}>{HELPLINE.international}</Text>

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.primaryEndBtn, SHADOWS.card]}
                activeOpacity={0.85}
                onPress={onEndSession}
                accessibilityRole="button"
                accessibilityLabel="End session and save"
              >
                <Ionicons
                  name="stop-circle-outline"
                  size={moderateScale(18)}
                  color={COLORS.textDark}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryEndBtnText}>End session & protect bankroll</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                onPress={onAcknowledge}
                accessibilityRole="button"
                accessibilityLabel="Acknowledge and continue"
              >
                <Text style={styles.secondaryBtnText}>Acknowledge & continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = themed(() => ({
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
    fontFamily: 'display',
    fontSize: fluidFont(19),
    fontWeight: '600',
    textAlign: 'center',
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
    letterSpacing: 0.2,
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
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.successMuted,
    minHeight: TOUCH_TARGET.minSize,
  },
  supportText: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    flex: 1,
  },
  supportPhone: {
    color: COLORS.success,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  supportIntl: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    lineHeight: fluidFont(14),
    textAlign: 'center',
    width: '100%',
    marginTop: -SPACING.xs,
    marginBottom: SPACING.md,
    paddingHorizontal: 4,
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
}));
