import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { useSession } from '../context/SessionContext';

export default function StartSessionModal({ visible, onClose, onNavigateToBlackjack, onNavigateToPoker }) {
  const { activeSession, startSession, endActiveSession } = useSession();
  const insets = useSafeAreaInsets();

  const handleStartBlackjack = () => {
    if (!activeSession) {
      startSession('Blackjack');
    }
    onClose();
    if (onNavigateToBlackjack) {
      onNavigateToBlackjack();
    }
  };

  const handleStartPoker = () => {
    if (!activeSession) {
      startSession('Poker');
    }
    onClose();
    if (onNavigateToPoker) {
      onNavigateToPoker();
    }
  };

  const handleEndSession = () => {
    endActiveSession();
    onClose();
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
            <View
              style={[
                styles.sheetContainer,
                {
                  paddingBottom:
                    insets.bottom > 0
                      ? insets.bottom + moderateScale(12)
                      : moderateScale(24),
                },
              ]}
            >
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.sheetTitle}>
                    {activeSession ? 'Session In Progress' : 'Start New Session'}
                  </Text>
                  <Text style={styles.sheetSubtitle}>
                    {activeSession
                      ? 'You have an active session running'
                      : 'Select a game tracker to begin'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>

              {activeSession ? (
                /* Session Active Options */
                <View style={styles.activeContent}>
                  <View style={styles.activeInfoCard}>
                    <View style={styles.livePulseDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeGameTitle}>
                        Active {activeSession.gameType} Session
                      </Text>
                      <Text style={styles.activeGameMeta}>
                        {activeSession.hands.length} hands recorded
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, SHADOWS.card]}
                    activeOpacity={0.8}
                    onPress={() => {
                      onClose();
                      if (activeSession?.gameType === 'Poker') {
                        if (onNavigateToPoker) onNavigateToPoker();
                      } else {
                        if (onNavigateToBlackjack) onNavigateToBlackjack();
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Resume Session"
                  >
                    <Ionicons
                      name="play"
                      size={moderateScale(18)}
                      color={COLORS.textDark}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.primaryButtonText}>Resume Session</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.endSessionBtn}
                    activeOpacity={0.8}
                    onPress={handleEndSession}
                    accessibilityRole="button"
                    accessibilityLabel="End Session and Save"
                  >
                    <Ionicons
                      name="stop-circle-outline"
                      size={moderateScale(18)}
                      color={COLORS.danger}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.endSessionText}>End Session & Save to History</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Start New Session Options */
                <View style={styles.newContent}>
                  <TouchableOpacity
                    style={styles.gameOptionCard}
                    activeOpacity={0.8}
                    onPress={handleStartBlackjack}
                  >
                    <View style={styles.gameIconBox}>
                      <Ionicons name="game-controller" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.gameInfo}>
                      <View style={styles.gameTitleRow}>
                        <Text style={styles.gameTitle}>Blackjack Live Tracker</Text>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Ready</Text>
                        </View>
                      </View>
                      <Text style={styles.gameDescription}>
                        Track bets, doubles, splits, and calculate real-time net profit
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gameOptionCard}
                    activeOpacity={0.8}
                    onPress={handleStartPoker}
                  >
                    <View style={styles.gameIconBox}>
                      <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.gameInfo}>
                      <View style={styles.gameTitleRow}>
                        <Text style={styles.gameTitle}>Poker Session Tracker</Text>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Ready</Text>
                        </View>
                      </View>
                      <Text style={styles.gameDescription}>
                        Log your buy-in and cash-out to track your net result
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                  </TouchableOpacity>

                  {/* Future games go here as additional cards — greyed out until built */}
                  <View style={[styles.gameOptionCard, styles.gameOptionCardDisabled]}>
                    <View style={[styles.gameIconBox, styles.gameIconBoxDisabled]}>
                      <Ionicons name="hourglass-outline" size={24} color={COLORS.textMuted} />
                    </View>
                    <View style={styles.gameInfo}>
                      <View style={styles.gameTitleRow}>
                        <Text style={[styles.gameTitle, { color: COLORS.textMuted }]}>More games</Text>
                        <View style={styles.badgeMuted}>
                          <Text style={styles.badgeMutedText}>Soon</Text>
                        </View>
                      </View>
                      <Text style={styles.gameDescription}>New trackers are on the way</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
    overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderBottomWidth: 0,
    paddingTop: moderateScale(12),
    paddingHorizontal: SPACING.pageHorizontal,
    minHeight: '40%',
  },
  handleBar: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontSize: fluidFont(20),
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sheetSubtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  closeButton: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  newContent: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  gameOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameIconBox: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.25)',
  },
  gameInfo: {
    flex: 1,
    marginRight: 8,
  },
  gameTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameTitle: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  badge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: moderateScale(7),
    paddingVertical: moderateScale(2),
    borderRadius: RADIUS.xs,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: fluidFont(10),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gameDescription: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: fluidFont(16),
  },
  activeContent: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  activeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
    gap: SPACING.sm,
  },
  livePulseDot: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    backgroundColor: COLORS.primary,
  },
  activeGameTitle: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeGameMeta: {
    fontSize: fluidFont(12),
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    minHeight: TOUCH_TARGET.minSize,
  },
  primaryButtonText: {
    color: COLORS.textDark,
    fontSize: fluidFont(15),
    fontWeight: '800',
  },
  endSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(14),
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
    minHeight: TOUCH_TARGET.minSize,
  },
  endSessionText: {
    color: COLORS.danger,
    fontSize: fluidFont(14),
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minHeight: TOUCH_TARGET.minSize,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(14),
    fontWeight: '600',
  },
});
