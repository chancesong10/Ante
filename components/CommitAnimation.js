import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

// The "commit" beat from the start-session sheet: press-in, the icon tile
// flooding with the game's colour, and a ring rippling out from it — a chip
// landing on the felt — before the screen hands off.
//
// Extracted so the recent-sessions list on Home plays literally the same
// animation rather than a lookalike copy of it. (This codebase had four
// copies of renderGameIcon and three of the live dot before they were
// consolidated; one shared source is cheaper than keeping copies in step.)

// How long the beat runs before handing off. The flood has covered the tile
// and the ring is still expanding, so the hand-off reads as caused by it.
export const COMMIT_HANDOFF_MS = 250;
const REDUCED_HANDOFF_MS = 140;

export function useCommitPress({ reduced = false, dimmed = false, onCommit }) {
  const press = useRef(new Animated.Value(0)).current;
  const flood = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  // Never let a scheduled hand-off outlive the card.
  useEffect(() => () => clearTimeout(timer.current), []);

  // Step back while a sibling is the one being committed.
  useEffect(() => {
    const anim = Animated.timing(dim, {
      toValue: dimmed ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [dimmed, dim]);

  // The beat ends with the tile fully flooded, and on a screen that stays
  // mounted (a tab) nothing would ever put it back — so the caller has to
  // reset it once the hand-off is out of view. Stable identity so it can sit
  // in an effect's dependency list without re-running it every render.
  const reset = useCallback(() => {
    clearTimeout(timer.current);
    press.setValue(0);
    flood.setValue(0);
    ring.setValue(0);
    dim.setValue(0);
  }, [press, flood, ring, dim]);

  const play = () => {
    if (reduced) {
      Animated.timing(flood, { toValue: 1, duration: 140, useNativeDriver: true }).start();
      timer.current = setTimeout(() => onCommit?.(), REDUCED_HANDOFF_MS);
      return;
    }
    Animated.parallel([
      Animated.sequence([
        Animated.timing(press, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(press, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(flood, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(ring, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    timer.current = setTimeout(() => onCommit?.(), COMMIT_HANDOFF_MS);
  };

  return {
    play,
    reset,
    // Opacity of the colour flooding the icon tile.
    flood,
    // Wrap the whole card in an Animated.View carrying this.
    containerStyle: {
      opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
      transform: [
        { translateY: dim.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
        { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) },
      ],
    },
    // For the ring that ripples out of the tile.
    ringStyle: {
      opacity: ring.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.28, 0] }),
      transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] }) }],
    },
  };
}
