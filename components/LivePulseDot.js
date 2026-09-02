import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { moderateScale } from '../constants/layout';

export default function LivePulseDot({ size = 8, color = COLORS.danger, style }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}
