import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import ActiveSessionSlip from './ActiveSessionSlip';

// Everything currently running, one slip each. Capped at one session per
// game type, so this is never more than four rows — no pagination needed,
// and the sheet can size itself to the content.
export default function ActiveSessionsModal({
  visible,
  sessions = [],
  currencySymbol = '$',
  privacyMode = false,
  onClose,
  onResume,
  onEnd,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom > 0 ? insets.bottom + moderateScale(12) : moderateScale(20) },
              ]}
            >
              <View style={styles.handle} />

              <View style={styles.header}>
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Text style={styles.title}>
                    {sessions.length === 1 ? 'Session Running' : 'Sessions Running'}
                  </Text>
                  <Text style={styles.subtitle}>Tap one to resume, or stop it on the right</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={TOUCH_TARGET.hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {sessions.map((session) => (
                  <ActiveSessionSlip
                    key={session.id}
                    session={session}
                    currencySymbol={currencySymbol}
                    privacyMode={privacyMode}
                    onResume={() => onResume?.(session)}
                    onEnd={() => onEnd?.(session)}
                  />
                ))}
              </ScrollView>
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
  sheet: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.cardBorder,
    paddingTop: moderateScale(12),
    paddingHorizontal: SPACING.pageHorizontal,
  },
  handle: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: fluidFont(20),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  closeBtn: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Four rows fit comfortably; the cap keeps this from ever needing more.
  list: { maxHeight: moderateScale(320) },
  listContent: { gap: SPACING.sm, paddingBottom: SPACING.xs },
});
