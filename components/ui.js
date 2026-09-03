// Shared UI primitives. Every screen was re-declaring the same SafeArea +
// StatusBar + ScrollView shell, the same card style, the same uppercase
// eyebrow labels, and plain TouchableOpacity with no press feedback. This is
// the one place those live now.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TYPE, LAYOUT, TOUCH_TARGET } from '../constants/layout';

/* ------------------------------------------------------------------ motion */

// Reports the OS "reduce motion" setting and keeps it live.
export function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

// One authored entrance: fade + 10px rise, once on mount, staggered by `index`.
// Collapses to a static reveal when reduce-motion is on.
export function Rise({ index = 0, reduced, style, children }) {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return undefined;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 340,
      delay: 40 + index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, index, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [moderateScale(10), 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// "Live" is red app-wide (matches components/LivePulseDot) — the broadcast
// convention, and the one colour that can't be read as a money or brand accent.
export function LiveDot({ color = COLORS.danger, size = moderateScale(6) }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: pulse,
      }}
    />
  );
}

/* -------------------------------------------------------------- pressables */

// Pressable with a consistent press-dim. Drop-in for TouchableOpacity.
export function Tappable({ onPress, style, disabled, children, ...rest }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, pressed && !disabled && s.pressed, disabled && s.disabled]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

// Full-width primary / secondary action button.
export function Button({ label, icon, onPress, variant = 'primary', disabled, style }) {
  const isPrimary = variant === 'primary';
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.btn, isPrimary ? s.btnPrimary : s.btnGhost, style]}
    >
      {!!icon && (
        <Ionicons
          name={icon}
          size={moderateScale(16)}
          color={isPrimary ? COLORS.textDark : COLORS.textSecondary}
        />
      )}
      <Text style={isPrimary ? s.btnPrimaryText : s.btnGhostText}>{label}</Text>
    </Tappable>
  );
}

/* ------------------------------------------------------------------ shells */

// SafeArea + StatusBar + (optional) ScrollView with the standard page
// padding and tab-bar tail. Pass `navBar` for stack screens with a fixed
// header row; omit it for tab screens.
export function Screen({
  children,
  scroll = true,
  contentStyle,
  edges = ['top', 'left', 'right'],
  navBar = null,
}) {
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[
        s.scrollContent,
        { paddingBottom: insets.bottom + LAYOUT.scrollTail },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.flex, s.scrollContent, contentStyle]}>{children}</View>
  );

  if (navBar) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        {navBar}
        {body}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={edges}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {body}
    </SafeAreaView>
  );
}

// Fixed header row for stack screens: back chevron, title (optional live
// dot), optional right-side action.
export function NavBar({ title, onBack, live = false, right = null }) {
  return (
    <View style={s.navBar}>
      {onBack ? (
        <Tappable
          onPress={onBack}
          style={s.navBack}
          hitSlop={TOUCH_TARGET.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={moderateScale(22)} color={COLORS.textPrimary} />
        </Tappable>
      ) : (
        <View style={s.navBack} />
      )}
      <View style={s.navTitleWrap}>
        {live && <LiveDot />}
        <Text style={s.navTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={s.navRight}>{right}</View>
    </View>
  );
}

// In-scroll header for tab screens. Title is sentence-case, left-aligned,
// no tracked eyebrow.
export function ScreenHeader({ title, subtitle, right = null, style }) {
  return (
    <View style={[s.header, style]}>
      <View style={s.flex}>
        <Text style={s.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={s.headerSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

/* --------------------------------------------------------------- structure */

export function SectionHeader({ title, right = null, style }) {
  return (
    <View style={[s.sectionHeader, style]}>
      <Text style={s.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

// Standard surface. `elevated` bumps it one lightness step for the rare
// case something must read as raised. Do not nest these.
export function Card({ children, style, elevated = false }) {
  return <View style={[s.card, elevated && s.cardElevated, style]}>{children}</View>;
}

// A statement figure set on the page (no card): small caption, big tabular
// value, optional sub-row (a delta line, etc).
export function StatementValue({ label, value, tone, sub = null, style }) {
  return (
    <View style={style}>
      <Text style={s.stmtLabel}>{label}</Text>
      <Text style={[s.stmtValue, !!tone && { color: tone }]}>{value}</Text>
      {sub != null && <View style={s.stmtSub}>{sub}</View>}
    </View>
  );
}

// N figures in a row between hairlines — replaces the nested "stat sub-card".
// items: [{ label, value, tone? }]
export function LedgerStrip({ items, style }) {
  return (
    <View style={[s.ledger, style]}>
      {items.map((it, i) => (
        <React.Fragment key={it.label}>
          {i > 0 && <View style={s.ledgerDivider} />}
          <View style={s.ledgerItem}>
            <Text style={[s.ledgerValue, !!it.tone && { color: it.tone }]} numberOfLines={1}>
              {it.value}
            </Text>
            <Text style={s.ledgerLabel} numberOfLines={1}>
              {it.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// Grouped list: one bordered container, hairline dividers between rows, no
// per-row card. Wrap each child row in <ListRow>.
export function ListGroup({ children, style }) {
  const rows = React.Children.toArray(children);
  return (
    <View style={[s.listGroup, style]}>
      {rows.map((child, i) => (
        <View key={child.key ?? i} style={i > 0 ? s.listRowBorder : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function ListRow({ onPress, children, style, accessibilityLabel }) {
  const Comp = onPress ? Tappable : View;
  return (
    <Comp
      onPress={onPress}
      style={[s.listRow, style]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Comp>
  );
}

/* ------------------------------------------------------------------ styles */

const s = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.4 },

  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.pageHorizontal,
    paddingTop: SPACING.md,
  },

  // NavBar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.pageHorizontal,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  navBack: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: moderateScale(19),
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(7),
  },
  navTitle: {
    ...TYPE.heading,
    color: COLORS.textPrimary,
  },
  navRight: {
    minWidth: moderateScale(38),
    alignItems: 'flex-end',
  },

  // ScreenHeader
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  headerTitle: {
    ...TYPE.title,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // SectionHeader
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: LAYOUT.sectionGap,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    ...TYPE.heading,
    color: COLORS.textPrimary,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardElevated: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.cardBorderHighlight,
  },

  // StatementValue
  stmtLabel: {
    ...TYPE.caption,
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
    marginBottom: moderateScale(6),
  },
  stmtValue: {
    ...TYPE.display,
    color: COLORS.textPrimary,
  },
  stmtSub: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: moderateScale(5),
    marginTop: moderateScale(8),
  },

  // LedgerStrip
  ledger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  ledgerItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: moderateScale(4),
  },
  ledgerDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: moderateScale(2),
    backgroundColor: COLORS.cardBorder,
  },
  ledgerValue: {
    fontSize: fluidFont(19),
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  ledgerLabel: {
    ...TYPE.label,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 3,
  },

  // ListGroup / ListRow
  listGroup: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  listRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
  },

  // Button
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(6),
    borderRadius: RADIUS.sm,
    paddingVertical: moderateScale(13),
    minHeight: TOUCH_TARGET.minSize,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnPrimaryText: {
    color: COLORS.textDark,
    fontSize: fluidFont(14),
    fontWeight: '700',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: COLORS.cardBorderHighlight,
  },
  btnGhostText: {
    color: COLORS.textSecondary,
    fontSize: fluidFont(13),
    fontWeight: '600',
  },
});
