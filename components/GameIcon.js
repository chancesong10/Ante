// One place for "which glyph represents this game type". Was copy-pasted in
// HomeScreen, AnalyticsScreen and HistoryScreen.
import React from 'react';
import { View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, getGameColor, getGameColorMuted, themed } from '../constants/theme';
import { moderateScale } from '../constants/layout';

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

// Round chip holding the game glyph: a soft pastel of the game's colour with
// the glyph in the colour itself, matching the start-session sheet's
// `gameIconBox` so a game looks the same wherever it appears.
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
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: getGameColorMuted(gameType) },
        style,
      ]}
    >
      {children}
      {renderGameIcon(gameType, glyph, getGameColor(gameType))}
    </View>
  );
}

const styles = themed(() => ({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
}));
