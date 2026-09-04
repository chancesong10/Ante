import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { GameIconTile } from './GameIcon';
import LivePulseDot from './LivePulseDot';

// Computes what a running session is worth right now. Mirrors the tracker
// screens' own live totals: hand-based games sum netChange, buy-in games use
// the pair once both halves are entered.
export function liveNetOf(session) {
  const hands = Array.isArray(session?.hands) ? session.hands : [];
  if (hands.length > 0) {
    return hands
      .flatMap((r) => (r.type === 'split' && r.hands ? r.hands : [r]))
      .reduce((sum, h) => sum + (h.netChange || 0), 0);
  }
  if (session?.buyIn != null && session?.cashOut != null) {
    return session.cashOut - session.buyIn;
  }
  return 0;
}

export function liveCountOf(session) {
  const hands = Array.isArray(session?.hands) ? session.hands : [];
  return hands.flatMap((r) => (r.type === 'split' && r.hands ? r.hands : [r])).length;
}

const UNIT = {
  Poker: 'hands',
  'Sports Betting': 'bets',
  Roulette: 'spins',
  Baccarat: 'hands',
  General: 'entries',
};

// One running session. The whole slip is the resume target — tapping
// anywhere opens that tracker — and the stop button on the right is the only
// other affordance, so there's one obvious action and one deliberate one.
export default function ActiveSessionSlip({ session, currencySymbol = '$', privacyMode = false, onResume, onEnd }) {
  const net = liveNetOf(session);
  const count = liveCountOf(session);
  const unit = UNIT[session.gameType] || 'hands';
  const tone = net > 0 ? COLORS.success : net < 0 ? COLORS.danger : COLORS.textPrimary;

  return (
    <View style={[styles.slip, SHADOWS.card]}>
      <TouchableOpacity
        style={styles.main}
        activeOpacity={0.75}
        onPress={onResume}
        accessibilityRole="button"
        accessibilityLabel={`Resume ${session.gameType} session`}
      >
        <GameIconTile
          gameType={session.gameType}
          size={moderateScale(38)}
          glyph={moderateScale(18)}
          style={styles.tile}
        />

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <LivePulseDot size={moderateScale(6)} />
            <Text style={styles.title} numberOfLines={1}>
              {session.gameType}
            </Text>
          </View>
          <Text style={styles.meta}>
            {count} {unit} logged
          </Text>
        </View>

        <Text style={[styles.net, { color: tone }]} numberOfLines={1}>
          {privacyMode
            ? '••••'
            : `${net > 0 ? '+' : net < 0 ? '-' : ''}${currencySymbol}${Math.abs(net).toFixed(2)}`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.stopBtn}
        activeOpacity={0.75}
        onPress={onEnd}
        hitSlop={TOUCH_TARGET.hitSlop}
        accessibilityRole="button"
        accessibilityLabel={`End ${session.gameType} session`}
      >
        <Ionicons name="stop-circle" size={moderateScale(22)} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    paddingRight: moderateScale(6),
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(14),
    minHeight: TOUCH_TARGET.minSize,
  },
  tile: { marginRight: SPACING.sm },
  info: { flex: 1, marginRight: SPACING.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: moderateScale(6) },
  title: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  meta: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: 3,
  },
  net: {
    fontSize: fluidFont(14),
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginRight: SPACING.xs,
  },
  stopBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
