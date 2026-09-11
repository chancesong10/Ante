import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/theme';
import { CARD_RANKS } from '../utils/blackjackStrategy';

const spoken = (rank) => (rank === 'A' ? 'Ace' : rank === '10' ? '10 or face card' : rank);

// The ten rank buttons. `selected` can hold a rank twice (a pair), which shows
// as a small ×2 under it.
export function RankPicker({ selected = [], onPick, label }) {
  return (
    <View style={styles.rankRow}>
      {CARD_RANKS.map((rank) => {
        const count = selected.filter((r) => r === rank).length;
        const active = count > 0;
        return (
          <TouchableOpacity
            key={rank}
            style={[styles.rankButton, active && styles.rankButtonActive]}
            onPress={() => onPick(rank)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${spoken(rank)}`}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.rankText, active && styles.rankTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {rank}
            </Text>
            {count > 1 && <Text style={styles.rankCount}>×2</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// A card as it lands on the felt. An empty slot is a dashed outline; tapping a
// card takes it back off.
export function CardFace({ rank, onPress, label }) {
  if (!rank) {
    return <View style={[styles.face, styles.faceEmpty]} accessibilityLabel={`${label}: empty`} />;
  }
  return (
    <TouchableOpacity
      style={styles.face}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${spoken(rank)}`}
      accessibilityHint="Removes this card"
    >
      <Text style={styles.faceCorner}>{rank}</Text>
      <Text style={styles.faceRank}>{rank}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rankRow: { flexDirection: 'row', gap: 4 },
  rankButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rankText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  rankTextActive: { color: COLORS.textDark },
  rankCount: { position: 'absolute', bottom: 2, fontSize: 8, fontWeight: '700', color: COLORS.textDark },
  face: {
    width: 46,
    height: 64,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.cardBorderHighlight,
  },
  faceCorner: { position: 'absolute', top: 4, left: 6, fontSize: 10, fontWeight: '700', color: COLORS.textDark },
  faceRank: { fontSize: 22, fontWeight: '800', color: COLORS.textDark },
});
