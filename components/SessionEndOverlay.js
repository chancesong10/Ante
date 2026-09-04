import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont } from '../constants/layout';
import { formatMoney, netTone } from '../utils/format';
import { useReduceMotion } from './ui';

// Closing beat for a session — the counterpart to the start-session sheet's
// commit animation (press -> flood -> ring).
//
// The two expensive things that have to happen (navigating to History, and
// committing the session so its row appears there) are deliberately split
// apart and both done while the wash is fully opaque. Doing them together
// was what made the end of this animation stutter: one burst of JS that
// re-rendered every history consumer, wrote AsyncStorage, kicked the cloud
// sync, ran the stack's pop animation and mounted History's list, all in the
// same frame the fade was trying to start in.
//
//   0ms    the wash floods out from just above the End button, tinted by the
//          result: green if the session made money, red if it lost.
//   200ms  the result figure rises in behind it.
//   340ms  COVER — the wash is opaque, so History is navigated to *now*.
//          Its mount, and the stack's pop animation, are completely hidden
//          and have ~half a second to settle before anything is revealed.
//   720ms  COMMIT — the session is written to history. The list is already
//          mounted by this point, so this is a cheap row insert rather than
//          a mount plus an insert.
//   820ms  the wash fades over 420ms — slow enough that the new row's own
//          slide-in animation plays *through* the fade, so the last thing
//          you see is the session landing in the list.
const FLOOD_MS = 300;
const RIPPLE_MS = 620;
const REVEAL_DELAY = 200;
const REVEAL_MS = 260;
const COVER_AT = 340;
const COMMIT_AT = 700;
// 160ms of headroom after the commit before anything starts to be revealed,
// so the re-render fan-out it causes (History, Analytics, Profile and Home
// all read session history) is finished before the fade begins.
const EXIT_AT = 860;
const EXIT_MS = 420;

export default function SessionEndOverlay({
  fx,
  currencySymbol = '$',
  privacyMode = false,
  onCover,
  onCommit,
  onDone,
}) {
  const { width, height } = useWindowDimensions();
  const reduced = useReduceMotion();

  const flood = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const timers = useRef([]);

  // Held in a ref so a re-render with new callback identities can't restart
  // a sequence that's already playing.
  const cbs = useRef({ onCover, onCommit, onDone });
  useEffect(() => {
    cbs.current = { onCover, onCommit, onDone };
  });

  const visible = !!fx;

  // Keyed on `fx` itself, not the `visible` boolean: the provider can hand
  // off straight from one queued session's wash to the next (clearing fx and
  // setting the next one in the same batch, so `visible` never actually
  // toggles false in between). A fresh `fx` object is only ever created for
  // a session that genuinely wants its own play-through, so restarting the
  // animation whenever the reference changes — even true-to-true — is
  // exactly the behaviour a second queued session needs.
  useEffect(() => {
    if (!fx) return undefined;

    if (reduced) {
      // No motion: do the work in order and get out of the way.
      cbs.current.onCover?.();
      cbs.current.onCommit?.();
      cbs.current.onDone?.();
      return undefined;
    }

    flood.setValue(0);
    ripple.setValue(0);
    reveal.setValue(0);
    exit.setValue(0);

    const intro = Animated.parallel([
      Animated.timing(flood, {
        toValue: 1,
        duration: FLOOD_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ripple, {
        toValue: 1,
        duration: RIPPLE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(reveal, {
        toValue: 1,
        duration: REVEAL_MS,
        delay: REVEAL_DELAY,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    intro.start();

    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));

    // Navigate under the cover of an opaque wash.
    at(COVER_AT, () => cbs.current.onCover?.());
    // Then insert the session into a list that is already on screen.
    at(COMMIT_AT, () => cbs.current.onCommit?.());
    // Then lift the wash, slowly enough to watch the row arrive.
    at(EXIT_AT, () => {
      Animated.timing(exit, {
        toValue: 1,
        duration: EXIT_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) cbs.current.onDone?.();
      });
    });

    return () => {
      intro.stop();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [fx, reduced, flood, ripple, reveal, exit]);

  if (!visible) return null;

  const net = fx.net || 0;
  const wash = net > 0 ? COLORS.washWin : net < 0 ? COLORS.washLoss : COLORS.washNeutral;
  const tone = netTone(net);

  // Origin sits where the End Session button does, so the wash reads as
  // spreading out from the thing that was pressed.
  const originX = width / 2;
  const originY = height * 0.86;
  const D = 2 * Math.hypot(originX, originY) * 1.06;
  const circle = {
    position: 'absolute',
    width: D,
    height: D,
    borderRadius: D / 2,
    left: originX - D / 2,
    top: originY - D / 2,
  };

  // A plain layer in the app's own view hierarchy rather than a Modal.
  // A Modal is a separate native window on Android, and cross-fading one out
  // while the window beneath it runs a navigation transition is exactly the
  // case that stutters. (AnimatedLoadingScreen in App.js layers the same way.)
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.layer,
        { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
      ]}
      pointerEvents="auto"
    >
      <Animated.View style={[circle, { backgroundColor: wash, transform: [{ scale: flood }] }]} />

      <Animated.View
        style={[
          circle,
          {
            borderWidth: 1,
            borderColor: tone,
            opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [
              { scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.04, 1.12] }) },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: reveal,
            transform: [
              { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          },
        ]}
        pointerEvents="none"
      >
        {!!fx.gameType && <Text style={styles.eyebrow}>{fx.gameType.toUpperCase()}</Text>}
        <Text style={[styles.figure, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(net, currencySymbol, privacyMode)}
        </Text>
        <View style={styles.rule} />
        <Text style={styles.caption}>SESSION SAVED TO HISTORY</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Above the navigator, below the splash (which sits at 999).
  layer: {
    zIndex: 900,
    elevation: 900,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(32),
  },
  eyebrow: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    letterSpacing: 3,
    color: COLORS.textSecondary,
  },
  figure: {
    fontSize: fluidFont(46),
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: moderateScale(10),
    fontVariant: ['tabular-nums'],
  },
  rule: {
    width: moderateScale(44),
    height: 1,
    backgroundColor: COLORS.primaryGlow,
    marginTop: moderateScale(18),
  },
  caption: {
    fontSize: fluidFont(11),
    fontWeight: '600',
    letterSpacing: 2.4,
    color: COLORS.textMuted,
    marginTop: moderateScale(14),
  },
});
