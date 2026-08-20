import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, ClipPath, Rect, Defs } from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { fluidFont } from '../constants/layout';

const CHART_HEIGHT = 160;
const TOP_PADDING = 14;
const BOTTOM_PADDING = 14;

// Cumulative net profit across every session, chronologically. The fill is
// split at the zero line — green above (currently ahead), red below
// (currently behind) — rather than coloring the whole trajectory by its
// final value, so a line that spent most of its life in profit still
// reads as such even if a late slide finally dipped it under.
export default function BankrollLineChart({ sessions, currencySymbol = '$', privacyMode = false }) {
  const [containerWidth, setContainerWidth] = useState(0);

  const cumulative = [];
  let running = 0;
  sessions.forEach((s) => {
    running += s.netProfit || 0;
    cumulative.push(running);
  });

  if (cumulative.length < 2 || containerWidth === 0) {
    return (
      <View style={styles.wrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        {cumulative.length < 2 && (
          <Text style={styles.notEnoughText}>Log at least 2 sessions to see your bankroll trend.</Text>
        )}
      </View>
    );
  }

  const width = containerWidth;
  const plotHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
  const values = [...cumulative, 0]; // always include the zero baseline in range
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const xFor = (i) => (i / (cumulative.length - 1)) * width;
  const yFor = (v) => TOP_PADDING + plotHeight - ((v - minVal) / range) * plotHeight;
  const zeroY = yFor(0);

  const points = cumulative.map((v, i) => [xFor(i), yFor(v)]);

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath =
    `${linePath} ` +
    `L ${points[points.length - 1][0].toFixed(1)} ${(TOP_PADDING + plotHeight).toFixed(1)} ` +
    `L ${points[0][0].toFixed(1)} ${(TOP_PADDING + plotHeight).toFixed(1)} Z`;

  const [lastX, lastY] = points[points.length - 1];
  const finalNet = cumulative[cumulative.length - 1];
  const trendColor = finalNet >= 0 ? COLORS.success : COLORS.danger;

  const fmt = (v) => (privacyMode ? '••••' : `${v >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(v).toFixed(0)}`);

  return (
    <View style={styles.wrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <View style={styles.labelRow}>
        <Text style={styles.axisLabel}>Session 1</Text>
        <Text style={[styles.axisLabel, styles.axisLabelEnd, { color: trendColor }]}>{fmt(finalNet)} now</Text>
      </View>

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

        <Line
          x1={0}
          y1={zeroY}
          x2={width}
          y2={zeroY}
          stroke={COLORS.cardBorder}
          strokeWidth={1}
          strokeDasharray="4,4"
        />

        <Path d={linePath} fill="none" stroke={COLORS.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        <Circle cx={lastX} cy={lastY} r={4.5} fill={COLORS.primary} stroke={COLORS.background} strokeWidth={2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  notEnoughText: {
    fontSize: fluidFont(12),
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 30,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  axisLabel: {
    fontSize: fluidFont(10),
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  axisLabelEnd: {
    fontWeight: '800',
  },
});
