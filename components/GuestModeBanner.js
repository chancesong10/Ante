import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';

// Shown on the trackers while signed out — data still tracks fine locally,
// but only lives in this device's storage until the user signs in, at which
// point it's adopted into their account (see useSyncEngine's ownership
// guard). This is the visible half of that contract: don't let someone
// track real sessions as a guest without knowing they're not backed up.
export default function GuestModeBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons name="warning" size={moderateScale(15)} color={COLORS.danger} style={styles.icon} />
      <Text style={styles.text}>Not signed in — data stored locally until you sign in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerMuted,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(9),
    paddingHorizontal: moderateScale(12),
    marginBottom: SPACING.md,
  },
  icon: {
    marginRight: moderateScale(8),
  },
  text: {
    flex: 1,
    color: COLORS.danger,
    fontSize: fluidFont(12),
    fontWeight: '700',
  },
});
