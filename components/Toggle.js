import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { moderateScale } from '../constants/layout';
import { hapticSelection } from '../utils/haptics';

const TRACK_W = moderateScale(50);
const TRACK_H = moderateScale(30);
const PAD = moderateScale(3);
const THUMB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;

// Replacement for RN's built-in Switch.
//
// Two things made the stock control feel delayed and choppy here:
//
//  1. Its `value` is owned by PreferencesContext, so a tap had to travel
//     through setPreferences -> context re-render -> ProfileScreen re-render
//     (a large component) -> back down as a new prop before the knob could
//     move. The knob was waiting on a round trip.
//  2. Animating a track *colour* can't use the native driver, so what
//     animation there was ran on the JS thread and got stuttered by that
//     same re-render work.
//
// This fixes both: `on` is local state that flips on press so the knob moves
// on the very next frame regardless of how slow the owner is, and everything
// animated here is transform/opacity only — so it runs on the UI thread and
// can't be blocked by JS. The track colour change is done by cross-fading a
// filled layer rather than tweening backgroundColor.
export default function Toggle({ value, onValueChange, disabled = false, accessibilityLabel }) {
  const [on, setOn] = useState(!!value);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  // Follow the owner if it changes from somewhere else (or rejects the change).
  useEffect(() => {
    setOn(!!value);
  }, [value]);

  useEffect(() => {
    const spring = Animated.spring(anim, {
      toValue: on ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    });
    spring.start();
    return () => spring.stop();
  }, [on, anim]);

  const handlePress = () => {
    if (disabled) return;
    const next = !on;
    setOn(next); // animate now
    hapticSelection();
    onValueChange?.(next); // let the slower state path catch up
  };

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={moderateScale(8)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: on, disabled }}
      style={disabled && styles.disabled}
    >
      <Animated.View style={styles.track}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { opacity: anim }]} />
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: COLORS.switchTrackOff,
    padding: PAD,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: TRACK_H / 2,
    backgroundColor: COLORS.switchTrackOn,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: COLORS.primary,
    // Lifts the knob off the track so the control reads as a physical switch.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: 0.4,
  },
});
