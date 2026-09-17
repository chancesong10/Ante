import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Easing, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, TOUCH_TARGET } from '../constants/layout';

// The circled ⓘ that opens a tracker's guide.
//
// Deliberately sits on the LEFT of the header next to the back button, not on
// the right: the right-hand slot is "End Session", and putting a curiosity tap
// target next to a button that ends someone's live session is asking for a
// mis-tap that costs them their data.
//
// Until the guide has been opened once for this game, a soft halo breathes
// behind the icon. That's the whole discovery mechanism — no takeover, no
// blocking modal on first launch, just something that reads as "there's
// something here" and then goes quiet permanently once tapped.

export default function TrackerGuideButton({ onPress, unseen = false, tint = COLORS.accentCyan }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!unseen) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [unseen, pulse]);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={TOUCH_TARGET.hitSlop}
      accessibilityRole="button"
      accessibilityLabel="What this tracker records"
    >
      {unseen && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              borderColor: tint,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
            },
          ]}
        />
      )}
      <View style={[styles.circle, unseen && { borderColor: tint }]}>
        <Ionicons
          name="information"
          size={moderateScale(13)}
          color={unseen ? tint : COLORS.textSecondary}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: moderateScale(34),
    height: moderateScale(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: COLORS.cardBorderHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  halo: {
    position: 'absolute',
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
  },
});
