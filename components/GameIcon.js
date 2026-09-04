// One place for "which glyph represents this game type". Was copy-pasted in
// HomeScreen, AnalyticsScreen and HistoryScreen.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, RADIUS } from '../constants/layout';

export function renderGameIcon(gameType, size = 18, color = COLORS.primary) {
  if (gameType === 'Poker') {
    return <Ionicons name="cash-outline" size={size} color={color} />;
  }
  if (gameType === 'Sports Betting') {
    return <Ionicons name="basketball-outline" size={size} color={color} />;
  }
  if (gameType === 'General') {
    return <Ionicons name="dice-outline" size={size} color={color} />;
  }
  if (gameType === 'Roulette') {
    // No wheel glyph in either icon set — a plain disc reads as the wheel.
    return <Ionicons name="disc-outline" size={size} color={color} />;
  }
  if (gameType === 'Baccarat') {
    return <MaterialCommunityIcons name="cards-diamond-outline" size={size} color={color} />;
  }
  // Outline variant, so Blackjack is drawn as a thin line like the other
  // three rather than as a solid filled glyph.
  return <MaterialCommunityIcons name="cards-outline" size={size} color={color} />;
}

// Rounded tile holding the game glyph — the small square that encapsulates
// the icon. Style is lifted verbatim from the start-session sheet's
// `gameIconBox` (dark surface, thin 1px border) and the glyph is drawn in
// COLORS.primary exactly as that sheet draws it, so the two match.
// `children` render behind the glyph, so a caller can layer effects inside
// the tile (the commit flood and ripple ring on Home's recent sessions).
export function GameIconTile({
  gameType,
  size = moderateScale(36),
  glyph = moderateScale(17),
  style,
  children,
}) {
  return (
    <View style={[styles.tile, { width: size, height: size }, style]}>
      {children}
      {renderGameIcon(gameType, glyph, COLORS.primary)}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryGlow,
    overflow: 'visible',
  },
});
