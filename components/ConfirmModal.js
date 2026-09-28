import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, themed } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';

// Getters, so each read picks up the active palette.
const VARIANTS = {
  danger: {
    icon: 'alert-circle-outline',
    get color() {
      return COLORS.danger;
    },
    get muted() {
      return COLORS.dangerMuted;
    },
    get border() {
      return COLORS.dangerBorder;
    },
  },
  warning: {
    icon: 'warning-outline',
    get color() {
      return COLORS.warning;
    },
    get muted() {
      return COLORS.warningMuted;
    },
    get border() {
      return COLORS.warningBorder;
    },
  },
  primary: {
    icon: 'information-circle-outline',
    get color() {
      return COLORS.primary;
    },
    get muted() {
      return COLORS.primaryMuted;
    },
    get border() {
      return COLORS.primaryGlow;
    },
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
      <View style={styles.overlay} accessibilityViewIsModal>
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
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: 'display',
    fontSize: fluidFont(18),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontSize: fluidFont(13),
    get color() {
      return COLORS.textSecondary;
    },
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
    get color() {
      return COLORS.textDark;
    },
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
    get color() {
      return COLORS.textSecondary;
    },
    fontSize: fluidFont(13),
    fontWeight: '700',
  },
}));
