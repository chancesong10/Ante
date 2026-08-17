import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function AddActionModal({ visible, onClose, onSelectAction }) {
  const actions = [
    {
      id: 'log-session',
      title: 'Log a session',
      subtitle: 'Track hands, buy-ins, and live table games',
      icon: 'game-controller-outline',
      target: 'Blackjack',
      badge: 'Live',
    },
    {
      id: 'manual-entry',
      title: 'Manual entry',
      subtitle: 'Record an offline session outcome or bankroll adjustment',
      icon: 'calculator-outline',
      target: 'ManualEntry',
      badge: null,
    },
    {
      id: 'deposit-withdraw',
      title: 'Deposit / Cash out',
      subtitle: 'Add bankroll funds or record an active withdrawal',
      icon: 'cash-outline',
      target: 'BankrollAction',
      badge: null,
    },
    {
      id: 'set-goal',
      title: 'Set session goal & stop-loss',
      subtitle: 'Configure target payout and risk safety triggers',
      icon: 'shield-checkmark-outline',
      target: 'GoalAction',
      badge: 'Safety',
    },
  ];

  const handleAction = (item) => {
    onClose();
    if (onSelectAction) {
      onSelectAction(item);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Drag Handle Indicator */}
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.sheetTitle}>New Action</Text>
                  <Text style={styles.sheetSubtitle}>
                    Choose how you want to record your activity
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Distinct Selectable Rows */}
              <View style={styles.optionsList}>
                {actions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.optionRow}
                    activeOpacity={0.7}
                    onPress={() => handleAction(item)}
                  >
                    <View style={styles.iconCircle}>
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={COLORS.primary}
                      />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <View style={styles.optionTitleRow}>
                        <Text style={styles.optionTitle}>{item.title}</Text>
                        {item.badge && (
                          <View style={styles.badgeContainer}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.optionSubtitle}>
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick Cancel Button */}
              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.8}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsList: {
    gap: 12,
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.2)',
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  badgeContainer: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  optionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
