import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, themed } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';

// Shown on the trackers while signed out — data still tracks fine locally,
// but only lives in this device's storage until the user signs in, at which
// point it's adopted into their account (see useSyncEngine's ownership
// guard). This is the visible half of that contract: don't let someone
// track real sessions as a guest without knowing they're not backed up.
// A calm note rather than an alarm: nothing is wrong, it just isn't backed up.
export default function GuestModeBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons
        name="phone-portrait-outline"
        size={moderateScale(16)}
        color={COLORS.warning}
        style={styles.icon}
      />
      <Text style={styles.text}>Saved on this phone only. Sign in from Profile to back it up.</Text>
    </View>
  );
}

const styles = themed(() => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningMuted,
    borderRadius: RADIUS.md,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(14),
    marginBottom: SPACING.md,
  },
  icon: {
    marginRight: moderateScale(8),
  },
  text: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: fluidFont(13),
    fontWeight: '500',
  },
}));
