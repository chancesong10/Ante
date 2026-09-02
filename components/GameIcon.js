// One place for "which glyph represents this game type". Was copy-pasted in
// HomeScreen, AnalyticsScreen and HistoryScreen.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getGameColor, getGameColorMuted } from '../constants/theme';
import { moderateScale, RADIUS } from '../constants/layout';

export function renderGameIcon(gameType, size = 18, color = getGameColor(gameType)) {
  if (gameType === 'Poker') {
    return <Ionicons name="cash-outline" size={size} color={color} />;
  }
  if (gameType === 'Sports Betting') {
    return <Ionicons name="basketball-outline" size={size} color={color} />;
  }
  if (gameType === 'General') {
    return <Ionicons name="dice-outline" size={size} color={color} />;
  }
  return <MaterialCommunityIcons name="cards" size={size} color={color} />;
}

// Rounded tile holding the game glyph, tinted in the game's own colour.
export function GameIconTile({ gameType, size = moderateScale(36), glyph = moderateScale(17), style }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: getGameColorMuted(gameType) },
        style,
      ]}
    >
      {renderGameIcon(gameType, glyph, getGameColor(gameType))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
