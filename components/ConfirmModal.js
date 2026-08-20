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

const VARIANTS = {
  danger: {
    icon: 'alert-circle-outline',
    color: COLORS.danger,
    muted: COLORS.dangerMuted,
    border: COLORS.dangerBorder,
  },
  warning: {
    icon: 'warning-outline',
    color: COLORS.warning,
    muted: COLORS.warningMuted,
    border: COLORS.warningBorder,
  },
  primary: {
    icon: 'information-circle-outline',
    color: COLORS.primary,
    muted: COLORS.primaryMuted,
    border: COLORS.primaryGlow,
  },
};

export default function ConfirmModal({
  visible,
  variant = 'danger',
  icon,
  title,
  message,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCancel = true,
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;

  const v = VARIANTS[variant] || VARIANTS.danger;
  const closeAction = onCancel || onConfirm;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeAction}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback>
          <View style={[styles.modalCard, SHADOWS.card]}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: v.muted, borderColor: v.border },
              ]}
            >
              <Ionicons name={icon || v.icon} size={moderateScale(30)} color={v.color} />
            </View>

            <Text style={[styles.title, { color: v.color }]}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {children}

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: v.color }, SHADOWS.card]}
                activeOpacity={0.85}
                onPress={onConfirm}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>{confirmText}</Text>
              </TouchableOpacity>

              {showCancel && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  activeOpacity={0.85}
                  onPress={onCancel}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryBtnText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
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
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: fluidFont(16),
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  message: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: fluidFont(18),
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  buttonGroup: {
    width: '100%',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    minHeight: TOUCH_TARGET.minSize,
  },
  primaryBtnText: {
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
