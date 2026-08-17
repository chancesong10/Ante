import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Baseline design dimensions (Standard flagship phone baseline: 390x844)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Scales a size based on screen width relative to standard baseline.
 */
export const scale = (size) => {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
};

/**
 * Scales a size based on screen height relative to standard baseline.
 */
export const verticalScale = (size) => {
  return (SCREEN_HEIGHT / BASE_HEIGHT) * size;
};

/**
 * Moderate scaling: Scales with a dampening factor to prevent elements
 * from becoming disproportionately small on compact phones or huge on tablets/large phones.
 * @param {number} size Base size in points
 * @param {number} factor Dampening factor (0 = unscaled, 1 = full scale, default = 0.5)
 */
export const moderateScale = (size, factor = 0.5) => {
  return Math.round(size + (scale(size) - size) * factor);
};

/**
 * Calculates a width percentage relative to device viewport width.
 * @param {number} percentage (e.g. 50 for 50% width)
 */
export const wp = (percentage) => {
  return (percentage * SCREEN_WIDTH) / 100;
};

/**
 * Calculates a height percentage relative to device viewport height.
 * @param {number} percentage (e.g. 50 for 50% height)
 */
export const hp = (percentage) => {
  return (percentage * SCREEN_HEIGHT) / 100;
};

/**
 * Dynamic typography scaler that accounts for device pixel ratio and font scaling
 * with safe upper and lower boundaries to ensure legibility without clipping.
 * @param {number} size Base font size
 * @param {number} maxMultiplier Maximum scaling cap (prevents card layout overflow)
 */
export const fluidFont = (size, maxMultiplier = 1.3) => {
  const scaled = moderateScale(size, 0.4);
  const fontScale = PixelRatio.getFontScale();
  const cappedScale = Math.min(fontScale, maxMultiplier);
  return Math.round(scaled * cappedScale);
};

// Device classification helpers
export const DEVICE = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmallScreen: SCREEN_WIDTH < 375,
  isTallScreen: SCREEN_HEIGHT / SCREEN_WIDTH > 2.0, // e.g. Samsung 20:9, Pixel 20:9
  isTablet: SCREEN_WIDTH >= 768,
  aspectRatio: SCREEN_HEIGHT / SCREEN_WIDTH,
};

// Fluid Standard Spacing Scale
export const SPACING = {
  xxs: moderateScale(4),
  xs: moderateScale(8),
  sm: moderateScale(12),
  md: moderateScale(16),
  lg: moderateScale(20),
  xl: moderateScale(24),
  xxl: moderateScale(32),
  pageHorizontal: moderateScale(16, 0.3),
  cardPadding: moderateScale(16, 0.3),
};

// Fluid Standard Border Radii
export const RADIUS = {
  xs: moderateScale(6),
  sm: moderateScale(10),
  md: moderateScale(14),
  lg: moderateScale(18),
  xl: moderateScale(24),
  pill: 9999,
};

// Ergonomic Touch Minimums (Apple HIG 44x44pt, Android Material 48x48dp)
export const TOUCH_TARGET = {
  minSize: Platform.OS === 'ios' ? 44 : 48,
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
};
