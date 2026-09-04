import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { renderGameIcon } from './GameIcon';
import { hapticLight } from '../utils/haptics';

const ROW_HEIGHT = moderateScale(56);

// Drag-to-reorder list for a small, fixed set of rows (the six games). Every
// row is absolutely positioned and moved purely via a `translateY` transform
// — none of this leans on flex reflow or LayoutAnimation (untested on
// Android without extra setup, and this repo doesn't use it anywhere else),
// so there's nothing fighting the drag for who owns a row's position.
//
// The technique: each key owns one Animated.Value holding its current
// translateY. At rest that's `index * ROW_HEIGHT`, sprung there whenever a
// swap changes its index. The row actually being dragged is the one
// exception — its value is set directly (no animation) from the raw finger
// position every move, so it never fights the spring and always tracks
// exactly under the touch. `order` (plain state, driving each row's index)
// only changes in discrete swaps as the dragged row's live position crosses
// a neighbour's midpoint — that's what makes the other rows visibly shift
// out of the way rather than just watching the dragged row slide past them.
export default function ReorderableGameList({ initialOrder, onChange }) {
  const [order, setOrder] = useState(initialOrder);
  const orderRef = useRef(initialOrder);
  const [draggingKey, setDraggingKey] = useState(null);
  const draggingKeyRef = useRef(null);
  const dragStartYRef = useRef(0);

  // One Animated.Value per key, created once — the set of games never
  // changes while this list is mounted (it's remounted fresh, via `key` on
  // the modal's visibility, whenever the six could plausibly have changed).
  const positions = useRef(
    Object.fromEntries(initialOrder.map((key, i) => [key, new Animated.Value(i * ROW_HEIGHT)]))
  ).current;

  // Springs every non-dragged row to its current slot whenever the order
  // changes. The dragged row is excluded — its value is being driven live by
  // the gesture below, and springing it here would fight that.
  useEffect(() => {
    order.forEach((key, i) => {
      if (key === draggingKeyRef.current) return;
      Animated.spring(positions[key], {
        toValue: i * ROW_HEIGHT,
        useNativeDriver: true,
        bounciness: 6,
      }).start();
    });
  }, [order, positions]);

  const settle = (key) => {
    const idx = orderRef.current.indexOf(key);
    Animated.spring(positions[key], {
      toValue: idx * ROW_HEIGHT,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
    draggingKeyRef.current = null;
    setDraggingKey(null);
    onChange?.(orderRef.current);
  };

  // One PanResponder per key, built once and reused — recreating them every
  // render would swap out the responder mid-gesture and drop the touch.
  const responders = useRef({});
  order.forEach((key) => {
    if (responders.current[key]) return;
    responders.current[key] = PanResponder.create({
      // Claim immediately on touch-down rather than waiting for movement —
      // the handle has no press action of its own to protect, so there's
      // nothing lost by grabbing early, and waiting invites exactly the
      // responder-negotiation flakiness the Start Session sheet's own drag
      // handle hit before it was changed to claim on start.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        hapticLight();
        draggingKeyRef.current = key;
        setDraggingKey(key);
        dragStartYRef.current = orderRef.current.indexOf(key) * ROW_HEIGHT;
        positions[key].setValue(dragStartYRef.current);
      },
      onPanResponderMove: (_, gesture) => {
        const rawY = dragStartYRef.current + gesture.dy;
        positions[key].setValue(rawY);

        const current = orderRef.current;
        const fromIndex = current.indexOf(key);
        const maxIndex = current.length - 1;
        const toIndex = Math.min(maxIndex, Math.max(0, Math.round(rawY / ROW_HEIGHT)));
        if (toIndex !== fromIndex) {
          const next = [...current];
          next.splice(fromIndex, 1);
          next.splice(toIndex, 0, key);
          orderRef.current = next;
          setOrder(next);
          hapticLight();
        }
      },
      onPanResponderRelease: () => settle(key),
      onPanResponderTerminate: () => settle(key),
    });
  });

  return (
    <View style={{ height: order.length * ROW_HEIGHT }}>
      {order.map((key) => {
        const isDragging = draggingKey === key;
        return (
          <Animated.View
            key={key}
            style={[
              styles.row,
              {
                transform: [{ translateY: positions[key] }],
                zIndex: isDragging ? 10 : 1,
                elevation: isDragging ? 6 : 0,
                opacity: isDragging ? 0.96 : 1,
              },
            ]}
          >
            <View style={styles.iconCircle}>{renderGameIcon(key, moderateScale(18), COLORS.primary)}</View>
            <Text style={styles.label} numberOfLines={1}>
              {key}
            </Text>
            <View
              {...responders.current[key].panHandlers}
              style={styles.handle}
              hitSlop={TOUCH_TARGET.hitSlop}
              accessibilityRole="adjustable"
              accessibilityLabel={`Drag to reorder ${key}`}
            >
              <Ionicons name="reorder-three-outline" size={moderateScale(20)} color={COLORS.textMuted} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    // Matches modalSheet's own background — this list is a straightforward
    // stand-in inside that sheet, not a card of its own.
    backgroundColor: COLORS.backgroundSecondary,
  },
  iconCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(10),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  label: {
    flex: 1,
    fontSize: fluidFont(14),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  handle: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(10),
  },
});
