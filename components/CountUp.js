import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useReduceMotion } from './ui';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// A number that counts up to its value instead of snapping to it.
//
// Text content can't be animated on the native driver — only transforms and
// opacity can — so this drives a rAF loop and re-renders. That's fine for a
// handful of headline figures, and deliberately not something to sprinkle
// over a list: every frame is a React render.
//
// It animates *from wherever it currently is*, so a figure that changes while
// on screen (a session lands in History) slides to the new number rather than
// restarting from zero.
export default function CountUp({
  value = 0,
  format = (n) => String(n),
  duration = 750,
  animate = true,
  style,
  ...rest
}) {
  const reduced = useReduceMotion();
  const skip = reduced || !animate;

  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const frame = useRef(null);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (skip) {
      displayRef.current = value;
      setDisplay(value);
      return undefined;
    }

    const from = displayRef.current;
    if (from === value) return undefined;

    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setDisplay(from + (value - from) * easeOutCubic(t));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, skip]);

  return (
    <Text style={style} {...rest}>
      {format(skip ? value : display)}
    </Text>
  );
}
