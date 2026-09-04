import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Line, Circle, ClipPath, Rect, Defs, Text as SvgText, G } from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { fluidFont } from '../constants/layout';
import { useReduceMotion } from './ui';

const AnimatedG = Animated.createAnimatedComponent(G);

const CHART_HEIGHT = 170;
const TOP_PADDING = 22;
const BOTTOM_PADDING = 22;

const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Cumulative net profit across every session, chronologically, starting
// from an implicit $0 before the first session so the line reads as a
// full journey rather than starting mid-story. The fill is split at the
// zero line — green above (currently ahead), red below (currently
// behind) — rather than colored by the final value alone, so a line that
// spent most of its life in profit still reads that way even after a
// late dip. Peak and trough are called out directly on the chart, not
// just implied by its shape, and the header row gives the three numbers
// that actually matter without having to read pixel heights.
function BankrollLineChart({ sessions, currencySymbol = '$', privacyMode = false }) {
  const [containerWidth, setContainerWidth] = useState(0);

  const reduced = useReduceMotion();
  const animReveal = useRef(new Animated.Value(0)).current;
  const animIndicators = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (containerWidth > 0 && sessions.length >= 2) {
      // Reduced motion: land on the finished chart rather than wiping to it.
      if (reduced) {
        animReveal.setValue(1);
        animIndicators.setValue(1);
        return;
      }
      animReveal.setValue(0);
      animIndicators.setValue(0);
      Animated.sequence([
        Animated.timing(animReveal, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animIndicators, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [containerWidth, sessions, reduced]);

  // The geometry pass (cumulative series, SVG path strings, peak/trough
  // scan) only needs to redo when the sessions themselves or the measured
  // container width change — not on every parent re-render.
  const chart = useMemo(() => {
    const cumulative = [];
    let running = 0;
    sessions.forEach((s) => {
      running += s.netProfit || 0;
      cumulative.push(running);
    });
    const series = [0, ...cumulative]; // index 0 is the implicit pre-session start

    if (cumulative.length < 2 || containerWidth === 0) {
      return { ready: false, cumulative };
    }

    const width = containerWidth;
    const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
    const minVal = Math.min(...series);
    const maxVal = Math.max(...series);
    const range = maxVal - minVal || 1;

    const xFor = (i) => (i / (series.length - 1)) * width;
    const yFor = (v) => TOP_PADDING + plotHeight - ((v - minVal) / range) * plotHeight;
    const zeroY = yFor(0);

    const points = series.map((v, i) => [xFor(i), yFor(v)]);

    const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const areaPath =
      `${linePath} ` +
      `L ${points[points.length - 1][0].toFixed(1)} ${(TOP_PADDING + plotHeight).toFixed(1)} ` +
      `L ${points[0][0].toFixed(1)} ${(TOP_PADDING + plotHeight).toFixed(1)} Z`;

    const lastIndex = series.length - 1;
    const finalNet = series[lastIndex];
    const trendColor = finalNet >= 0 ? COLORS.success : COLORS.danger;

    // Peak/trough, excluding the implicit start (index 0) and the endpoint
    // (already marked) so the callouts point at something new.
    let peakIndex = null;
    let troughIndex = null;
    for (let i = 1; i < lastIndex; i++) {
      if (peakIndex === null || series[i] > series[peakIndex]) peakIndex = i;
      if (troughIndex === null || series[i] < series[troughIndex]) troughIndex = i;
    }
    const showPeak = peakIndex !== null && series[peakIndex] > Math.max(series[0], finalNet);
    const showTrough = troughIndex !== null && series[troughIndex] < Math.min(series[0], finalNet) && troughIndex !== peakIndex;

    return {
      ready: true,
      series,
      cumulative,
      width,
      minVal,
      maxVal,
      zeroY,
      points,
      linePath,
      areaPath,
      finalNet,
      trendColor,
      peakIndex,
      troughIndex,
      showPeak,
      showTrough,
    };
  }, [sessions, containerWidth]);

  if (!chart.ready) {
    return (
      <View style={styles.wrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        {chart.cumulative.length < 2 && (
          <Text style={styles.notEnoughText}>Log at least 2 sessions to see your bankroll trend.</Text>
        )}
      </View>
    );
  }

  const {
    width,
    minVal,
    maxVal,
    zeroY,
    points,
    linePath,
    areaPath,
    finalNet,
    trendColor,
    peakIndex,
    troughIndex,
    showPeak,
    showTrough,
    series,
  } = chart;

  const fmt = (v) => (privacyMode ? '••••' : `${v >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(v).toFixed(0)}`);
  const fmtFull = (v) => (privacyMode ? '••••••' : `${v >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(v).toFixed(2)}`);

  const firstDate = sessions[0]?.startTime ? fmtDate(sessions[0].startTime) : 'Start';
  const lastDate = sessions[sessions.length - 1]?.startTime ? fmtDate(sessions[sessions.length - 1].startTime) : 'Now';

  return (
    <View style={styles.wrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {/* Headline stats — the numbers that actually matter, without reading pixel heights */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Peak</Text>
          <Text style={[styles.statValue, { color: COLORS.success }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmtFull(maxVal)}
          </Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={[styles.statValue, { color: trendColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmtFull(finalNet)}
          </Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Low</Text>
          <Text style={[styles.statValue, { color: COLORS.danger }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmtFull(minVal)}
          </Text>
        </View>
      </View>

      <View style={{ position: 'relative', overflow: 'hidden' }}>
        <Svg width={width} height={CHART_HEIGHT}>
          <Defs>
            <ClipPath id="aboveZero">
              <Rect x={0} y={0} width={width} height={Math.max(0, zeroY)} />
            </ClipPath>
            <ClipPath id="belowZero">
              <Rect x={0} y={Math.max(0, zeroY)} width={width} height={CHART_HEIGHT} />
            </ClipPath>
          </Defs>

          <Path d={areaPath} fill={COLORS.success} fillOpacity={0.16} clipPath="url(#aboveZero)" />
          <Path d={areaPath} fill={COLORS.danger} fillOpacity={0.16} clipPath="url(#belowZero)" />

          <Line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke={COLORS.cardBorder} strokeWidth={1} strokeDasharray="4,4" />
          <SvgText x={4} y={zeroY - 4} fontSize={9} fontWeight="600" fill={COLORS.textMuted}>
            {privacyMode ? '••' : `${currencySymbol}0`}
          </SvgText>

          <Path d={linePath} fill="none" stroke={trendColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {showPeak && (
            <AnimatedG opacity={animIndicators}>
              <Circle cx={points[peakIndex][0]} cy={points[peakIndex][1]} r={3.5} fill={COLORS.success} stroke={COLORS.background} strokeWidth={1.5} />
              <SvgText
                x={Math.min(Math.max(points[peakIndex][0], 26), width - 8)}
                y={Math.max(points[peakIndex][1] - 8, 10)}
                fontSize={9}
                fontWeight="700"
                fill={COLORS.success}
                textAnchor="middle"
              >
                {fmt(series[peakIndex])}
              </SvgText>
            </AnimatedG>
          )}

          {showTrough && (
            <AnimatedG opacity={animIndicators}>
              <Circle cx={points[troughIndex][0]} cy={points[troughIndex][1]} r={3.5} fill={COLORS.danger} stroke={COLORS.background} strokeWidth={1.5} />
              <SvgText
                x={Math.min(Math.max(points[troughIndex][0], 26), width - 8)}
                y={Math.min(points[troughIndex][1] + 15, CHART_HEIGHT - 6)}
                fontSize={9}
                fontWeight="700"
                fill={COLORS.danger}
                textAnchor="middle"
              >
                {fmt(series[troughIndex])}
              </SvgText>
            </AnimatedG>
          )}
        </Svg>
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: width,
          backgroundColor: COLORS.card,
          transform: [
            {
              translateX: animReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0, width]
              })
            }
          ]
        }} />
      </View>

      <View style={styles.labelRow}>
        <Text style={styles.axisLabel}>{firstDate}</Text>
        <Text style={styles.axisLabel}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.axisLabel}>{lastDate}</Text>
      </View>
    </View>
  );
}

export default React.memo(BankrollLineChart);

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  notEnoughText: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 30,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statLabel: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisLabel: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
