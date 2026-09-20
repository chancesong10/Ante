import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { fluidFont, moderateScale } from '../constants/layout';
import { SkeletonBar } from './InsightsPaywall';

// Shared across every insights screen. When `locked`, the real value is
// never rendered at all — a redacted bar stands in for it instead — so
// there's nothing sensitive underneath to recover.
export default function InsightStatLine({ label, subLabel, value, valueColor, locked }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.labelCol}>
        <Text style={styles.statRowLabel}>{label}</Text>
        {!!subLabel && <Text style={styles.statRowSubLabel}>{subLabel}</Text>}
      </View>
      {locked ? (
        <SkeletonBar width={64} height={13} />
      ) : (
        <Text
          style={[styles.statRowValue, valueColor && { color: valueColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(7),
  },
  labelCol: {
    flex: 1,
    marginRight: moderateScale(8),
    justifyContent: 'center',
  },
  statRowLabel: {
    fontSize: fluidFont(13),
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  statRowSubLabel: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: moderateScale(2),
  },
  statRowValue: {
    fontSize: fluidFont(13),
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
