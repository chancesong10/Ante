import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { fluidFont, moderateScale, RADIUS } from '../constants/layout';
import { SkeletonBar } from './InsightsPaywall';

// Shared across every insights screen. When `locked`, the real value/sub
// text is replaced with redacted bars instead of being rendered and
// covered — nothing sensitive is ever drawn to the screen.
export default function InsightCompareStat({ label, value, valueColor, sub, locked }) {
  return (
    <View style={styles.compareCol}>
      {/* Fixed two-line height so a long label ("Return on Invested") and a
          short one ("Net Result") reserve the same space — otherwise the
          values below them land at different heights across the row. */}
      <Text
        style={styles.compareColLabel}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
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
  // Flattened: a hairline-bordered cell on the card ground, not a filled
  // sub-card nested inside the parent card.
  compareCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(10),
    alignItems: 'center',
  },
  compareColLabel: {
    fontSize: fluidFont(10),
    lineHeight: fluidFont(13),
    height: fluidFont(13) * 2,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  compareColValue: {
    fontSize: fluidFont(18),
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  compareColSub: {
    fontSize: fluidFont(11),
    color: COLORS.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});
