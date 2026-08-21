import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import { COLORS } from '../constants/theme';
import { moderateScale } from '../constants/layout';

export default function AnimatedLoadingScreen({ isAppReady, onFinish }) {
  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textScale = useRef(new Animated.Value(0.5)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // Track if we've started the exit sequence
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    // 1. Create the pulsing animation loop
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.15,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Start pulsing
    pulseAnimation.start();

    // 2. When the app is ready, stop pulsing and play the exit transition
    if (isAppReady && !isFinishing) {
      setIsFinishing(true);
      
      // We give it a tiny delay so it doesn't jarringly snap if the app loads instantly
      setTimeout(() => {
        pulseAnimation.stop();
        
        Animated.sequence([
          // Shrink and fade out logo
          Animated.parallel([
            Animated.timing(logoScale, {
              toValue: 0,
              duration: 400,
              easing: Easing.in(Easing.back(2)),
              useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
          // Fade in and scale up the text "Ante"
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(textScale, {
              toValue: 1,
              duration: 500,
              easing: Easing.out(Easing.back(1.5)),
              useNativeDriver: true,
            }),
          ]),
          // Brief pause so the user can actually read "Ante"
          Animated.delay(500),
          // Finally, fade out the whole screen to reveal the app underneath
          Animated.timing(containerOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          })
        ]).start(() => {
          // Tell App.js to completely unmount this screen
          onFinish();
        });
      }, 500);
    }

    return () => {
      pulseAnimation.stop();
    };
  }, [isAppReady, isFinishing, logoScale, logoOpacity, textOpacity, textScale, containerOpacity, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.centerContainer}>
        {/* Pulsing Logo */}
        <Animated.Image
          source={require('../assets/logo_transparent.png')}
          style={[
            styles.logo,
            {
              transform: [{ scale: logoScale }],
              opacity: logoOpacity,
            },
          ]}
          resizeMode="contain"
        />

        {/* 'Ante' Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ scale: textScale }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.anteText}>Ante</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: moderateScale(120),
    height: moderateScale(120),
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  anteText: {
    fontSize: moderateScale(52),
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 2,
  },
});
