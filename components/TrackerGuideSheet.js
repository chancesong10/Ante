import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GuideArt from './GuideArt';
import { guideForGame } from '../constants/trackerGuides';
import { COLORS, SHADOWS } from '../constants/theme';
import { moderateScale, fluidFont, SPACING, RADIUS, TOUCH_TARGET } from '../constants/layout';
import { hapticSelection } from '../utils/haptics';

// The animated explainer behind the ⓘ in every tracker header.
//
// Panels come from constants/trackerGuides.js, so this component knows nothing
// about any particular game — adding a tracker is a data change.
//
// Paging is a horizontal ScrollView rather than a custom pan responder: it
// gives native momentum, edge resistance and accessibility for free, and it
// can't fight the vertical gesture of the sheet itself.

export default function TrackerGuideSheet({ visible, gameType, onClose, navigation }) {
  const guide = guideForGame(gameType);
  const panels = guide?.panels ?? [];

  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);

  // Entrance: the sheet lifts and fades as one piece. Kept separate from the
  // per-panel art loops so a slow art can never hold up the sheet appearing.
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      setIndex(0);
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, enter]);

  // Reset to the first panel whenever the sheet is reopened, including when
  // the ScrollView has kept its old offset from last time.
  useEffect(() => {
    if (visible && width > 0) {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [visible, width]);

  const goTo = useCallback(
    (next) => {
      if (!width || next < 0 || next >= panels.length) return;
      hapticSelection();
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    },
    [width, panels.length]
  );

  const onMomentumEnd = useCallback(
    (e) => {
      if (!width) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(next);
    },
    [width, index]
  );

  const handleInsights = useCallback(
    (payoff) => {
      if (!payoff?.route || !navigation) return;
      onClose?.();
      // Navigate after the dismiss so the sheet isn't animating out on top of
      // a screen transition.
      requestAnimationFrame(() => {
        navigation.navigate(payoff.route, payoff.params);
      });
    },
    [navigation, onClose]
  );

  if (!visible || !guide) return null;

  const tint = COLORS[guide.accent] || COLORS.accentCyan;
  const isLast = index === panels.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              style={[
                styles.sheet,
                SHADOWS.card,
                {
                  opacity: enter,
                  transform: [
                    { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
                    { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
                  ],
                },
              ]}
            >
              <View style={styles.header}>
                <View style={styles.headerTitleWrap}>
                  <View style={[styles.headerBadge, { borderColor: tint }]}>
                    <Ionicons name="information" size={moderateScale(12)} color={tint} />
                  </View>
                  <Text style={styles.headerTitle}>{gameType} guide</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={TOUCH_TARGET.hitSlop}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.pager} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 && (
                  <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={onMomentumEnd}
                    scrollEventThrottle={16}
                  >
                    {panels.map((panel, i) => (
                      <View key={i} style={[styles.panel, { width }]}>
                        {/* Only the panel on screen animates — the rest hold
                            at their start frame rather than looping unseen. */}
                        <GuideArt art={panel.art} active={visible && i === index} tint={tint} />

                        <Text style={styles.panelHeading}>{panel.heading}</Text>
                        <Text style={styles.panelBody}>{panel.body}</Text>

                        {!!panel.points?.length && (
                          <View style={styles.points}>
                            {panel.points.map((point, pi) => (
                              <View key={pi} style={styles.pointRow}>
                                <View style={[styles.pointDot, { backgroundColor: tint }]} />
                                <Text style={styles.pointText}>{point}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {!!panel.payoff && (
                          <View style={[styles.payoff, { borderColor: tint }]}>
                            {panel.payoff.stats.map((stat, si) => (
                              <View key={si} style={styles.pointRow}>
                                <Ionicons
                                  name="trending-up"
                                  size={moderateScale(13)}
                                  color={tint}
                                  style={styles.payoffIcon}
                                />
                                <Text style={styles.payoffText}>{stat}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.footer}>
                <View style={styles.dots}>
                  {panels.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === index && { backgroundColor: tint, width: moderateScale(16) },
                      ]}
                    />
                  ))}
                </View>

                {isLast ? (
                  <View style={styles.footerActions}>
                    {!!panels[index]?.payoff?.route && (
                      <TouchableOpacity
                        style={styles.ghostBtn}
                        activeOpacity={0.8}
                        onPress={() => handleInsights(panels[index].payoff)}
                      >
                        <Text style={styles.ghostBtnText}>See insights</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onClose}>
                      <Text style={styles.primaryBtnText}>Start tracking</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.footerActions}>
                    <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.8} onPress={onClose}>
                      <Text style={styles.ghostBtnText}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      activeOpacity={0.85}
                      onPress={() => goTo(index + 1)}
                    >
                      <Text style={styles.primaryBtnText}>Next</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={moderateScale(14)}
                        color={COLORS.textDark}
                        style={{ marginLeft: 6 }}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  sheet: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  headerBadge: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(11),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  },
  headerTitle: {
    fontSize: fluidFont(15),
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  pager: { width: '100%' },
  panel: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  panelHeading: {
    fontSize: fluidFont(18),
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxs,
  },
  panelBody: {
    fontSize: fluidFont(13),
    lineHeight: fluidFont(19),
    color: COLORS.textSecondary,
  },

  points: { marginTop: SPACING.sm },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.xxs },
  pointDot: {
    width: moderateScale(5),
    height: moderateScale(5),
    borderRadius: 3,
    marginTop: moderateScale(7),
    marginRight: SPACING.xs,
  },
  pointText: {
    flex: 1,
    fontSize: fluidFont(12),
    lineHeight: fluidFont(18),
    color: COLORS.textSecondary,
  },

  payoff: {
    marginTop: SPACING.sm,
    padding: moderateScale(12),
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    backgroundColor: COLORS.card,
  },
  payoffIcon: { marginTop: moderateScale(2), marginRight: SPACING.xs },
  payoffText: {
    flex: 1,
    fontSize: fluidFont(12),
    lineHeight: fluidFont(18),
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.md,
  },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: 3,
    marginRight: moderateScale(5),
    backgroundColor: COLORS.cardBorderHighlight,
  },
  footerActions: { flexDirection: 'row', alignItems: 'center' },
  ghostBtn: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(9),
    marginRight: SPACING.xs,
  },
  ghostBtnText: {
    fontSize: fluidFont(13),
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    borderRadius: RADIUS.sm,
  },
  primaryBtnText: {
    fontSize: fluidFont(13),
    fontWeight: '800',
    color: COLORS.textDark,
  },
});
