import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';

export function ExpandableSection({ title, defaultExpanded = false, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <View style={styles.section}>
      <Pressable 
        style={styles.header} 
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.title}>{title}</Text>
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={moderateScale(18)} 
          color={COLORS.textMuted} 
        />
      </Pressable>
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

export function ProgressBar({ label, valueText, percent, color = COLORS.primary }) {
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{valueText}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function TrendArrow({ trend, label, valueText, goodIsUp = true }) {
  const isUp = trend > 0;
  const isNeutral = trend === 0;
  
  let color = COLORS.textMuted;
  let icon = "remove";
  
  if (!isNeutral) {
    if (isUp) {
      color = goodIsUp ? COLORS.success : COLORS.danger;
      icon = "arrow-up";
    } else {
      color = goodIsUp ? COLORS.danger : COLORS.success;
      icon = "arrow-down";
    }
  }

  return (
    <View style={styles.trendContainer}>
      <View style={styles.trendRow}>
        <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={moderateScale(14)} color={color} />
        </View>
        <View style={styles.trendTextCol}>
          <Text style={styles.trendLabel}>{label}</Text>
          <Text style={styles.trendValue}>{valueText}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    minHeight: TOUCH_TARGET,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: fluidFont(15),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    padding: SPACING.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceHighlight,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(13),
  },
  progressValue: {
    color: COLORS.textPrimary,
    fontSize: fluidFont(13),
    fontWeight: '500',
  },
  track: {
    height: moderateScale(6),
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.round,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: RADIUS.round,
  },
  trendContainer: {
    marginBottom: SPACING.md,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  trendTextCol: {
    flex: 1,
  },
  trendLabel: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(13),
  },
  trendValue: {
    color: COLORS.textPrimary,
    fontSize: fluidFont(14),
    fontWeight: '500',
  },
});
