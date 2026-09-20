import { useCallback, useEffect, useRef, useState } from 'react';

// A value that shows for a moment and then clears itself — the "Copied!" on
// the insights screens, the one-line notice on Profile and Account.
//
// Every screen had its own `setTimeout(() => setX(null), 2500)` with no
// cleanup, so leaving the screen mid-flash left a timer holding a closure and
// firing a render into a component that was gone. Eleven copies of that, and
// none of them cleared it.
//
// Re-flashing while one is already showing restarts the clock rather than
// letting the first timer cut the second message short.
//
// `restingValue` and `duration` are expected to be constants — every caller
// passes a literal `null`/`false` and a fixed number. They are dependencies of
// `flash` rather than being stashed in a ref, so a caller that did pass
// something new each render would get a correct (if less stable) callback
// instead of a silently stale resting value.
export default function useFlash(restingValue = null, duration = 2500) {
  const [value, setValue] = useState(restingValue);
  const timer = useRef(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const flash = useCallback(
    (next) => {
      clear();
      setValue(next);
      timer.current = setTimeout(() => {
        timer.current = null;
        setValue(restingValue);
      }, duration);
    },
    [clear, duration, restingValue]
  );

  useEffect(() => clear, [clear]);

  return [value, flash];
}
