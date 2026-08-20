import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS } from '../constants/layout';

// A redacted placeholder bar standing in for a real number/value when a
// section is locked. This is the actual guarantee against leaking data —
// nothing sensitive is ever rendered to the screen in this state, so
// there's no real text underneath to recover by squinting, screenshotting,
// or boosting contrast, the way a blurred copy of the real content would
// allow. A slow opacity pulse marks it as "loading/locked," not just a
// static gray box.
export function SkeletonBar({ width = 56, height = 14, style }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.skeletonBar,
        { width, height, borderRadius: height / 2, opacity: pulse },
        style,
      ]}
    />
  );
}

// Generic, non-data-specific "leak found" teaser — shown instead of the
// real leak headline when locked. Even leak TITLES sometimes name real
// data (e.g. "Fridays Are Costing You," "NBA Is Dragging Down Your
// Bankroll"), so this never touches the real leak object at all.
export function LockedLeakTeaser() {
  return (
    <View style={[styles.leakCard, SHADOWS.card]}>
      <View style={styles.leakEyebrowRow}>
        <Ionicons name="warning" size={14} color={COLORS.warning} />
        <Text style={styles.leakEyebrow}>PATTERN DETECTED</Text>
      </View>
      <Text style={styles.leakTitle}>We Found Something In Your Play</Text>
      <Text style={styles.leakDetail}>
        Ante's leak detector flagged a specific, costly pattern in your data. Unlock Pro to see exactly what it is — and what it's costing you.
      </Text>
      <View style={styles.leakSkeletonLines}>
        <SkeletonBar width="92%" height={11} />
        <SkeletonBar width="68%" height={11} />
      </View>
    </View>
  );
}

// The floating "unlock" card, pinned in the viewport (not scrolling with
// the masked content behind it). `pointerEvents="box-none"` on the outer
// wrapper lets scroll gestures pass through everywhere except the card
// itself.
export function InsightsUnlockCta({ subtitle, onPress }) {
  return (
    <View style={styles.ctaFloatWrap} pointerEvents="box-none">
      <View style={[styles.ctaCard, SHADOWS.card]}>
        <View style={styles.ctaIconBadge}>
          <Ionicons name="lock-closed" size={moderateScale(24)} color={COLORS.primary} />
        </View>
        <Text style={styles.ctaTitle}>Unlock Behavioral Insights</Text>
        <Text style={styles.ctaSubtitle}>
          {subtitle || 'Streaks, leak detection, and everything else on this page — unlocked with Ante Pro.'}
        </Text>
        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85} onPress={onPress}>
          <Ionicons name="sparkles" size={16} color={COLORS.textDark} style={{ marginRight: 6 }} />
          <Text style={styles.ctaButtonText}>Unlock in Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBar: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  leakCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.warningBorder,
    marginBottom: 14,
  },
  leakEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  leakEyebrow: { fontSize: 11, fontWeight: '700', color: COLORS.warning, letterSpacing: 1 },
  leakTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  leakDetail: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  leakSkeletonLines: { marginTop: 12, gap: 8 },
  ctaFloatWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.pageHorizontal,
  },
  ctaCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primaryGlow,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  ctaIconBadge: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
  },
  ctaTitle: {
    fontSize: fluidFont(17),
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  ctaSubtitle: {
    fontSize: fluidFont(12.5),
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: fluidFont(18),
    marginBottom: SPACING.md,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    paddingHorizontal: SPACING.lg,
  },
  ctaButtonText: {
    color: COLORS.textDark,
    fontWeight: '700',
    fontSize: fluidFont(14),
  },
});
