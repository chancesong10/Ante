import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';

// A compact switch for a table condition that changes the math — which wheel,
// what a Tie pays. It's set once per table rather than once per bet, so it
// sits quieter than the white bet pickers beside it.
export default function SegmentedPicker({ label, options, value, onChange, style }) {
  return (
    <View style={[styles.row, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.track} accessibilityRole="radiogroup">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={String(option.value)}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.accessibilityLabel || option.label}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
              {!!option.sub && (
                <Text style={[styles.segmentSub, active && styles.segmentSubActive]}>{option.sub}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 10,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: { backgroundColor: COLORS.cardElevated, borderColor: COLORS.cardBorderHighlight },
  segmentText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  segmentTextActive: { color: COLORS.textPrimary, fontWeight: '700' },
  segmentSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 1, fontWeight: '600' },
  segmentSubActive: { color: COLORS.textSecondary },
});
