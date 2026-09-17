import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../constants/theme';
import { moderateScale, fluidFont, RADIUS } from '../constants/layout';

// The animated illustrations behind each tracker-guide panel.
//
// Built from plain Views driven by Animated transforms rather than SVG, for
// one reason: opacity/translate/scale all run on the native driver, so these
// keep animating at 60fps while the JS thread is busy, and they can't stutter
// the sheet's own entrance. An SVG path-draw would need useNativeDriver:false
// and put every frame through the bridge.
//
// Every art is a loop that runs only while its panel is the visible one —
// `active` gates it, so five off-screen loops aren't burning frames.

const ART_HEIGHT = moderateScale(132);

// One shared driver per art: a 0 -> 1 ramp that repeats with a hold at each
// end, which reads as a deliberate demonstration rather than a nervous twitch.
function useLoop(active, { duration = 2200, hold = 600 } = {}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(hold),
        Animated.timing(progress, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(240),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [active, progress, duration, hold]);

  return progress;
}

// Staggered entrance for a list of elements off a single driver: element `i`
// starts once the ramp passes its slice, so n items sweep in rather than
// arriving together.
function stagger(progress, index, count, { from = 14 } = {}) {
  const slice = 0.62 / Math.max(1, count);
  const start = index * slice;
  const end = start + slice * 1.9;
  const range = [start, Math.min(end, 1)];
  return {
    opacity: progress.interpolate({ inputRange: [range[0], range[1]], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [range[0], range[1]],
          outputRange: [from, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
}

/* ---------------------------------------------------------------- chips ---
   A stack building up one chip at a time, with the bet total counting in
   underneath. Used wherever the point is "your stake is the thing we watch". */
function ChipsArt({ active, tint }) {
  const progress = useLoop(active, { duration: 1900 });
  const chips = [0, 1, 2, 3];

  return (
    <View style={styles.center}>
      <View style={styles.chipStack}>
        {chips.map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.chip,
              { borderColor: tint, bottom: i * moderateScale(9) },
              stagger(progress, i, chips.length, { from: 26 }),
            ]}
          >
            <View style={[styles.chipInner, { backgroundColor: tint }]} />
          </Animated.View>
        ))}
      </View>
      <Animated.View
        style={[
          styles.valuePill,
          { borderColor: tint },
          stagger(progress, chips.length - 0.4, chips.length, { from: 10 }),
        ]}
      >
        <Text style={[styles.valuePillText, { color: tint }]}>$25 bet</Text>
      </Animated.View>
    </View>
  );
}

/* ---------------------------------------------------------------- cards ---
   Two cards dealing in at a slight fan, then an outcome tag landing. */
function CardsArt({ active, tint }) {
  const progress = useLoop(active, { duration: 2000 });
  const cards = [
    { label: 'A', rotate: '-9deg', left: -moderateScale(26) },
    { label: '10', rotate: '7deg', left: moderateScale(26) },
  ];

  return (
    <View style={styles.center}>
      <View style={styles.cardRow}>
        {cards.map((card, i) => {
          const slice = stagger(progress, i, 3, { from: 30 });
          return (
            <Animated.View
              key={card.label}
              style={[
                styles.card,
                { left: card.left },
                {
                  opacity: slice.opacity,
                  transform: [...slice.transform, { rotate: card.rotate }],
                },
              ]}
            >
              <Text style={styles.cardText}>{card.label}</Text>
            </Animated.View>
          );
        })}
      </View>
      <Animated.View
        style={[styles.outcomeTag, { borderColor: tint }, stagger(progress, 2.2, 3, { from: 12 })]}
      >
        <Text style={[styles.outcomeTagText, { color: tint }]}>BLACKJACK</Text>
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------- streets ---
   Four street markers lighting up left to right with a connecting rail,
   and the pot total resolving at the end. */
function StreetsArt({ active, tint }) {
  const progress = useLoop(active, { duration: 2400 });
  const streets = ['PRE', 'FLOP', 'TURN', 'RIVER'];

  return (
    <View style={styles.center}>
      <View style={styles.streetRow}>
        <View style={styles.streetRail} />
        {streets.map((street, i) => (
          <Animated.View key={street} style={[styles.streetItem, stagger(progress, i, streets.length)]}>
            <View style={[styles.streetDot, { backgroundColor: tint, borderColor: tint }]} />
            <Text style={styles.streetLabel}>{street}</Text>
          </Animated.View>
        ))}
      </View>
      <Animated.View
        style={[styles.valuePill, { borderColor: tint }, stagger(progress, streets.length - 0.2, streets.length, { from: 10 })]}
      >
        <Text style={[styles.valuePillText, { color: tint }]}>pot $340</Text>
      </Animated.View>
    </View>
  );
}

/* ----------------------------------------------------------------- odds ---
   An odds badge, an arrow, and the payout it implies. */
function OddsArt({ active, tint }) {
  const progress = useLoop(active, { duration: 1900 });

  return (
    <View style={styles.center}>
      <View style={styles.oddsRow}>
        <Animated.View style={[styles.oddsBox, stagger(progress, 0, 3, { from: 18 })]}>
          <Text style={styles.oddsLabel}>ODDS</Text>
          <Text style={styles.oddsValue}>+150</Text>
        </Animated.View>

        <Animated.View style={[styles.oddsArrowWrap, stagger(progress, 1, 3, { from: 0 })]}>
          <View style={[styles.oddsArrowLine, { backgroundColor: tint }]} />
          <View style={[styles.oddsArrowHead, { borderLeftColor: tint }]} />
        </Animated.View>

        <Animated.View style={[styles.oddsBox, { borderColor: tint }, stagger(progress, 2, 3, { from: 18 })]}>
          <Text style={styles.oddsLabel}>TO WIN</Text>
          <Text style={[styles.oddsValue, { color: tint }]}>$150</Text>
        </Animated.View>
      </View>
      <Animated.View style={stagger(progress, 2.4, 3, { from: 8 })}>
        <Text style={styles.artCaption}>on a $100 stake</Text>
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------- pending ---
   A slip sitting open, with a slow breathing pulse to say "still waiting",
   then resolving into a settled tag. */
function PendingArt({ active, tint }) {
  const progress = useLoop(active, { duration: 2600, hold: 900 });
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.slip, stagger(progress, 0, 3, { from: 18 })]}>
        <View style={styles.slipRow}>
          <Animated.View
            style={[
              styles.slipDot,
              { backgroundColor: COLORS.warning, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
            ]}
          />
          <Text style={styles.slipText}>Lakers ML  ·  −120</Text>
        </View>
        <View style={[styles.slipBar, { width: '64%' }]} />
        <View style={[styles.slipBar, { width: '38%' }]} />
      </Animated.View>

      <Animated.View style={[styles.outcomeTag, { borderColor: tint }, stagger(progress, 2.1, 3, { from: 12 })]}>
        <Text style={[styles.outcomeTagText, { color: tint }]}>SETTLE WHEN IT LANDS</Text>
      </Animated.View>
    </View>
  );
}

/* ---------------------------------------------------------------- spots ---
   A row of bet spots with one selecting and showing its payout. */
function SpotsArt({ active, tint }) {
  const progress = useLoop(active, { duration: 2100 });
  const spots = ['STRAIGHT', 'SPLIT', 'DOZEN', 'EVEN'];
  const chosen = 2;

  return (
    <View style={styles.center}>
      <View style={styles.spotsRow}>
        {spots.map((spot, i) => {
          const isChosen = i === chosen;
          const slice = stagger(progress, i, spots.length, { from: 16 });
          return (
            <Animated.View
              key={spot}
              style={[
                styles.spot,
                isChosen && { borderColor: tint, backgroundColor: COLORS.cardElevated },
                slice,
              ]}
            >
              <Text style={[styles.spotText, isChosen && { color: tint }]}>{spot}</Text>
            </Animated.View>
          );
        })}
      </View>
      <Animated.View
        style={[styles.valuePill, { borderColor: tint }, stagger(progress, spots.length - 0.3, spots.length, { from: 10 })]}
      >
        <Text style={[styles.valuePillText, { color: tint }]}>pays 2 : 1</Text>
      </Animated.View>
    </View>
  );
}

/* ----------------------------------------------------------------- flow ---
   Money in on the left, money out on the right, and the net between them. */
function FlowArt({ active, tint }) {
  const progress = useLoop(active, { duration: 2100 });

  return (
    <View style={styles.center}>
      <View style={styles.flowRow}>
        <Animated.View style={[styles.flowCol, stagger(progress, 0, 3, { from: 20 })]}>
          <View style={[styles.flowBar, { height: moderateScale(34), backgroundColor: COLORS.cardBorderHighlight }]} />
          <Text style={styles.flowLabel}>BUY-IN</Text>
          <Text style={styles.flowValue}>$200</Text>
        </Animated.View>

        <Animated.View style={[styles.flowCol, stagger(progress, 1, 3, { from: 20 })]}>
          <View style={[styles.flowBar, { height: moderateScale(58), backgroundColor: tint }]} />
          <Text style={styles.flowLabel}>CASH-OUT</Text>
          <Text style={styles.flowValue}>$340</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.valuePill, { borderColor: tint }, stagger(progress, 2.2, 3, { from: 10 })]}>
        <Text style={[styles.valuePillText, { color: tint }]}>net +$140</Text>
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------------- insight ---
   A sparkline of bars rising into place, then the leak callout landing on
   top of it. This is the payoff panel's art, shared by every game. */
function InsightArt({ active, tint }) {
  const progress = useLoop(active, { duration: 2500, hold: 800 });
  const bars = [0.32, 0.5, 0.42, 0.66, 0.54, 0.78, 0.9];

  return (
    <View style={styles.center}>
      <View style={styles.chartRow}>
        {bars.map((h, i) => {
          const slice = stagger(progress, i, bars.length, { from: 0 });
          return (
            <Animated.View
              key={i}
              style={[
                styles.chartBarWrap,
                {
                  opacity: slice.opacity,
                  transform: [
                    {
                      scaleY: progress.interpolate({
                        inputRange: [i * (0.62 / bars.length), i * (0.62 / bars.length) + 0.28],
                        outputRange: [0.04, 1],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.chartBar,
                  {
                    height: moderateScale(56) * h,
                    backgroundColor: i === bars.length - 1 ? tint : COLORS.cardBorderHighlight,
                  },
                ]}
              />
            </Animated.View>
          );
        })}
      </View>

      <Animated.View
        style={[styles.leakTag, stagger(progress, bars.length - 0.4, bars.length, { from: 12 })]}
      >
        <View style={[styles.leakDot, { backgroundColor: COLORS.warning }]} />
        <Text style={styles.leakTagText}>leak found: chasing losses</Text>
      </Animated.View>
    </View>
  );
}

// Exported so the guide-content test can assert every art key a panel asks
// for actually has an illustration behind it.
export const ARTS = {
  chips: ChipsArt,
  cards: CardsArt,
  streets: StreetsArt,
  odds: OddsArt,
  pending: PendingArt,
  spots: SpotsArt,
  flow: FlowArt,
  insight: InsightArt,
};

export const GUIDE_ART_KEYS = Object.keys(ARTS);

export default function GuideArt({ art, active, tint = COLORS.accentCyan }) {
  const Art = ARTS[art] || ChipsArt;
  return (
    <View style={styles.stage}>
      <Art active={active} tint={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: ART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  artCaption: {
    fontSize: fluidFont(11),
    color: COLORS.textMuted,
    marginTop: moderateScale(8),
  },

  // Shared value pill used by several arts as the "and here's the result" beat.
  valuePill: {
    marginTop: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(5),
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    backgroundColor: COLORS.card,
  },
  valuePillText: {
    fontSize: fluidFont(12),
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // chips
  chipStack: {
    height: moderateScale(58),
    width: moderateScale(64),
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chip: {
    position: 'absolute',
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    borderWidth: 2,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInner: {
    width: moderateScale(18),
    height: moderateScale(18),
    borderRadius: moderateScale(9),
    opacity: 0.35,
  },

  // cards
  cardRow: {
    flexDirection: 'row',
    height: moderateScale(66),
    width: moderateScale(130),
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: moderateScale(44),
    height: moderateScale(62),
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    fontSize: fluidFont(20),
    fontWeight: '800',
    color: COLORS.textDark,
  },
  outcomeTag: {
    marginTop: moderateScale(14),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    backgroundColor: COLORS.card,
  },
  outcomeTagText: {
    fontSize: fluidFont(10),
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // streets
  streetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: moderateScale(240),
  },
  streetRail: {
    position: 'absolute',
    top: moderateScale(7),
    left: moderateScale(18),
    right: moderateScale(18),
    height: 1,
    backgroundColor: COLORS.cardBorderHighlight,
  },
  streetItem: { alignItems: 'center', width: moderateScale(56) },
  streetDot: {
    width: moderateScale(15),
    height: moderateScale(15),
    borderRadius: moderateScale(8),
    borderWidth: 2,
  },
  streetLabel: {
    marginTop: moderateScale(6),
    fontSize: fluidFont(9),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.textMuted,
  },

  // odds
  oddsRow: { flexDirection: 'row', alignItems: 'center' },
  oddsBox: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(9),
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderHighlight,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    minWidth: moderateScale(74),
  },
  oddsLabel: {
    fontSize: fluidFont(9),
    fontWeight: '700',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
  },
  oddsValue: {
    fontSize: fluidFont(17),
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  oddsArrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: moderateScale(8),
  },
  oddsArrowLine: { width: moderateScale(22), height: 2, opacity: 0.7 },
  oddsArrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },

  // pending
  slip: {
    width: moderateScale(210),
    padding: moderateScale(12),
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorderHighlight,
    backgroundColor: COLORS.card,
  },
  slipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(9) },
  slipDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(8),
  },
  slipText: { fontSize: fluidFont(12), fontWeight: '700', color: COLORS.textPrimary },
  slipBar: {
    height: moderateScale(5),
    borderRadius: 3,
    backgroundColor: COLORS.cardElevated,
    marginBottom: moderateScale(5),
  },

  // spots
  spotsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: moderateScale(240) },
  spot: {
    paddingHorizontal: moderateScale(9),
    paddingVertical: moderateScale(6),
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
    margin: moderateScale(3),
  },
  spotText: {
    fontSize: fluidFont(9),
    fontWeight: '800',
    letterSpacing: 0.6,
    color: COLORS.textMuted,
  },

  // flow
  flowRow: { flexDirection: 'row', alignItems: 'flex-end' },
  flowCol: { alignItems: 'center', marginHorizontal: moderateScale(16) },
  flowBar: {
    width: moderateScale(38),
    borderRadius: RADIUS.sm,
  },
  flowLabel: {
    marginTop: moderateScale(7),
    fontSize: fluidFont(9),
    fontWeight: '700',
    letterSpacing: 0.7,
    color: COLORS.textMuted,
  },
  flowValue: { fontSize: fluidFont(13), fontWeight: '800', color: COLORS.textPrimary },

  // insight
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: moderateScale(60),
  },
  chartBarWrap: { justifyContent: 'flex-end', marginHorizontal: moderateScale(3) },
  chartBar: {
    width: moderateScale(15),
    borderRadius: 3,
  },
  leakTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: moderateScale(14),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(5),
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    backgroundColor: COLORS.warningMuted,
  },
  leakDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: 3,
    marginRight: moderateScale(7),
  },
  leakTagText: {
    fontSize: fluidFont(11),
    fontWeight: '700',
    color: COLORS.warning,
  },
});
