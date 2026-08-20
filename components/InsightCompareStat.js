import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { SkeletonBar } from './InsightsPaywall';

// Shared across every insights screen. When `locked`, the real value/sub
// text is replaced with redacted bars instead of being rendered and
// covered — nothing sensitive is ever drawn to the screen.
export default function InsightCompareStat({ label, value, valueColor, sub, locked }) {
  return (
    <View style={styles.compareCol}>
      <Text style={styles.compareColLabel}>{label}</Text>
      {locked ? (
        <SkeletonBar width={48} height={16} style={{ marginTop: 2 }} />
      ) : (
        <Text
          style={[styles.compareColValue, valueColor && { color: valueColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {value}
        </Text>
      )}
      {locked ? (
        sub !== undefined && <SkeletonBar width={40} height={10} style={{ marginTop: 5 }} />
      ) : sub ? (
        <Text style={styles.compareColSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compareCol: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  compareColLabel: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginBottom: 4 },
  compareColValue: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  compareColSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
