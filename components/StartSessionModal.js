import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { useSession } from '../context/SessionContext';

export default function StartSessionModal({ visible, onClose, onNavigateToBlackjack }) {
  const { activeSession, startSession, endActiveSession } = useSession();

  const handleStartBlackjack = () => {
    if (!activeSession) {
      startSession('Blackjack');
    }
    onClose();
    if (onNavigateToBlackjack) {
      onNavigateToBlackjack();
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
            <View style={styles.sheetContainer}>
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View>
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
                  <Ionicons name="close" size={20} color={COLORS.textSecondary} />
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
                      if (onNavigateToBlackjack) onNavigateToBlackjack();
                    }}
                  >
                    <Ionicons name="play" size={18} color={COLORS.textDark} style={{ marginRight: 6 }} />
                    <Text style={styles.primaryButtonText}>Resume Session</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.endSessionBtn}
                    activeOpacity={0.8}
                    onPress={handleEndSession}
                  >
                    <Ionicons name="stop-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
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
                    style={[styles.primaryButton, SHADOWS.card]}
                    activeOpacity={0.85}
                    onPress={handleStartBlackjack}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={COLORS.textDark} style={{ marginRight: 6 }} />
                    <Text style={styles.primaryButtonText}>Start Blackjack Session</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancel Button */}
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
    fontWeight: '800',
    color: COLORS.textPrimary,
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
  newContent: {
    gap: 14,
    marginBottom: 14,
  },
  gameOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  gameIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
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
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  badge: {
    backgroundColor: COLORS.primaryMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gameDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  activeContent: {
    gap: 12,
    marginBottom: 14,
  },
  activeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.3)',
    gap: 12,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  activeGameTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeGameMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: COLORS.textDark,
    fontSize: 15,
    fontWeight: '800',
  },
  endSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.4)',
  },
  endSessionText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
