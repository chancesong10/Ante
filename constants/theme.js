import { StyleSheet } from 'react-native';
import { resolveFontStyle } from './fonts';

// Two palettes, one set of names.
//
// Ante is a warm, paper-and-ink app: cream pages, cocoa text, and a few soft
// pastels (tomato, sage, butter) that each carry one meaning. The dark palette
// is the same room with the lights down — warm charcoal, never blue-black —
// so the two read as one product rather than two themes.
//
// Every screen reads `COLORS.x` at render time and never holds on to a value,
// which is what lets the palette change underneath it (see `themed` below).
// Keep new tokens in BOTH palettes; a key missing from one is undefined there.

const LIGHT = {
  // Paper
  background: '#FBF5EC', // Cream
  backgroundSecondary: '#F4ECDF',
  card: '#FFFCF7', // A lighter sheet laid on the page
  cardElevated: '#F6EEE2',
  cardBorder: '#EDE2D1',
  cardBorderHighlight: '#DCCDB6',

  // Ink. `primary` is the strongest ink on the page, used both as a fill
  // (primary buttons) and as emphasised text, so it must equal textPrimary;
  // `primaryDark` / `textDark` are the paper colour that sits on top of it.
  primary: '#3B2F28', // Cocoa
  // Emphasis border for surfaces that should read as lifted above a plain
  // card — the Ante+ card, the paywall, an active session.
  primaryGlow: 'rgba(184, 71, 42, 0.35)',
  primaryMuted: '#F1E7D8',
  primaryDark: '#FFFCF7',

  // The brand's one warm accent. Tab selection, the start-session button,
  // gentle highlights. Deliberately orange-red rather than true red, so it
  // never reads as a loss — that is `danger`, which leans berry.
  accent: '#B8472A', // Tomato
  accentMuted: 'rgba(184, 71, 42, 0.12)',
  onAccent: '#FFFFFF', // Text and icons on an `accent` fill
  accentCyan: '#2F6D86', // Dusty blue — identity
  accentCyanMuted: 'rgba(47, 109, 134, 0.12)',
  accentOrange: '#945717', // Volume/heat, distinct from `warning`
  accentViolet: '#7951B5', // Device

  textPrimary: '#3B2F28',
  textSecondary: '#6B5C51',
  textMuted: '#726357',
  textDark: '#FFFCF7', // Text on a `primary` fill
  placeholder: '#A39383', // Hint text in empty inputs; quieter than any real value

  // Icons — see the rule in the dark palette's comment history: stat tiles
  // get their own hue; feature rows only where the hue means something.
  icon: '#736357',
  iconActive: '#3B2F28',

  // Money and status. Muted enough to sit on cream, dark enough to be read as
  // text: every text colour in this palette passes 4.5:1 on every surface it
  // sits on (the tomato accent included).
  success: '#2A734A', // Sage, deepened for legibility
  successGlow: 'transparent',
  successMuted: 'rgba(42, 115, 74, 0.12)',
  danger: '#B3394E', // Berry
  dangerGlow: 'transparent',
  dangerMuted: 'rgba(179, 57, 78, 0.1)',
  dangerBorder: 'rgba(179, 57, 78, 0.3)',
  warning: '#8C5B00', // Butter, deepened into honey so it reads as text
  warningGlow: 'transparent',
  warningMuted: 'rgba(230, 170, 50, 0.16)',
  warningBorder: 'rgba(200, 140, 20, 0.35)',
  info: '#2F6D86',
  neutral: '#F1E7D8',
  neutralBorder: '#DCCDB6',

  // Session-end wash (see components/SessionEndOverlay). Soft tints of the
  // result rather than a flood of it; the figure on top carries the colour.
  washLoss: '#F7E1E1',
  washWin: '#E0F0E4',
  washNeutral: '#F1E9DC',

  // Switches (see components/Toggle). On is ink, off is a pale groove, so
  // the state never depends on seeing a hue.
  switchTrackOff: '#E6DACA',
  switchTrackOn: '#3B2F28',
  switchThumb: '#FFFFFF',

  tabBar: '#FFFCF7',
  tabBarBorder: '#EDE2D1',
  tabBarInactive: '#726356',
  divider: '#EDE2D1',
  overlay: 'rgba(59, 47, 40, 0.45)',
  shadow: '#6B4F3A',

  statusBar: 'dark', // expo-status-bar style
  statusBarContent: 'dark-content', // react-native StatusBar barStyle
};

const DARK = {
  background: '#1C1714', // Warm charcoal
  backgroundSecondary: '#241E1A',
  card: '#26201C',
  cardElevated: '#312924',
  cardBorder: '#382F29',
  cardBorderHighlight: '#4C4038',

  primary: '#F6EDE1', // Warm paper white
  primaryGlow: 'rgba(240, 138, 108, 0.35)',
  primaryMuted: '#312924',
  primaryDark: '#1C1714',

  accent: '#F08A6C',
  accentMuted: 'rgba(240, 138, 108, 0.14)',
  onAccent: '#2A1712',
  accentCyan: '#7CC4DD',
  accentCyanMuted: 'rgba(124, 196, 221, 0.12)',
  accentOrange: '#F2A65A',
  accentViolet: '#C3A6EE',

  textPrimary: '#F6EDE1',
  textSecondary: '#C9BAAB',
  textMuted: '#A49383',
  textDark: '#1C1714',
  placeholder: '#7F7063',

  icon: '#C9BAAB',
  iconActive: '#F6EDE1',

  success: '#86CFA0',
  successGlow: 'transparent',
  successMuted: 'rgba(134, 207, 160, 0.15)',
  danger: '#F2899A',
  dangerGlow: 'transparent',
  dangerMuted: 'rgba(242, 137, 154, 0.15)',
  dangerBorder: 'rgba(242, 137, 154, 0.3)',
  warning: '#F2C46B',
  warningGlow: 'transparent',
  warningMuted: 'rgba(242, 196, 107, 0.15)',
  warningBorder: 'rgba(242, 196, 107, 0.3)',
  info: '#8FCBE3',
  neutral: '#312924',
  neutralBorder: '#4C4038',

  washLoss: '#35191C',
  washWin: '#16291D',
  washNeutral: '#2A231F',

  switchTrackOff: '#3A312B',
  switchTrackOn: '#8A7A6C',
  switchThumb: '#F6EDE1',

  tabBar: '#26201C',
  tabBarBorder: '#382F29',
  tabBarInactive: '#A0917F',
  divider: '#382F29',
  overlay: 'rgba(10, 7, 5, 0.65)',
  shadow: '#000000',

  statusBar: 'light',
  statusBarContent: 'light-content',
};

// Per-game accents, distinct from the status colours so a session's game
// reads at a glance in lists without relying on the icon glyph.
const GAME = {
  light: {
    Poker: '#7951B5', // Lavender, deepened
    Blackjack: '#3F67A0', // Cornflower
    'Sports Betting': '#256E7E', // Teal
    General: '#945717', // Apricot
    Roulette: '#B33755', // Rose — a shade off `danger`
    Baccarat: '#81610E', // Honey gold — a shade off `warning`
  },
  dark: {
    Poker: '#C3A6EE',
    Blackjack: '#8FB4EC',
    'Sports Betting': '#7CC4DD',
    General: '#F2A65A',
    Roulette: '#F29AB0',
    Baccarat: '#F2D27A',
  },
};

const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
const mutedOf = (set, alpha) =>
  Object.fromEntries(Object.entries(set).map(([k, v]) => [k, hexToRgba(v, alpha)]));

const GAME_MUTED = { light: mutedOf(GAME.light, 0.12), dark: mutedOf(GAME.dark, 0.14) };

// Shadows are warm and visible on paper; in the dark they mostly vanish, so
// they stay subtle there and surfaces separate by lightness instead.
const SHADOW_SETS = {
  light: {
    card: {
      shadowColor: '#6B4F3A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    neon: {
      shadowColor: '#6B4F3A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 5,
    },
  },
  dark: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 2,
    },
    neon: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};

export const PALETTES = { light: LIGHT, dark: DARK };

/* ------------------------------------------------------------ live palette */

let scheme = 'light';
let version = 0;
const listeners = new Set();

export const getColorScheme = () => scheme;

export function setColorScheme(next) {
  if (!PALETTES[next] || next === scheme) return;
  scheme = next;
  version += 1;
  listeners.forEach((l) => l(scheme));
}

export function subscribeColorScheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// An object whose every key reads through to the active scheme's value, so
// `COLORS.card` is always the current card colour without anyone re-importing.
function live(sets) {
  const view = {};
  Object.keys(sets.light).forEach((key) => {
    Object.defineProperty(view, key, { enumerable: true, get: () => sets[scheme][key] });
  });
  return view;
}

export const COLORS = live(PALETTES);
export const GAME_COLORS = live(GAME);
export const GAME_COLORS_MUTED = live(GAME_MUTED);
export const SHADOWS = live(SHADOW_SETS);

export const getGameColor = (gameType) => GAME_COLORS[gameType] || COLORS.primary;
export const getGameColorMuted = (gameType) => GAME_COLORS_MUTED[gameType] || COLORS.primaryMuted;

// A module-level stylesheet that follows the palette.
//
// `StyleSheet.create({...COLORS.x...})` at the top of a file captures the
// colours once, at import. `themed(() => ({...}))` builds the same sheet
// lazily and rebuilds it the first time it is read after the scheme changes,
// so `styles.card` is always current. It also assigns the app's typefaces —
// see constants/fonts — so no screen has to name a font file.
export function themed(factory) {
  let sheet = null;
  let builtFor = -1;
  const resolve = () => {
    if (builtFor !== version) {
      const raw = factory();
      Object.keys(raw).forEach((key) => {
        raw[key] = resolveFontStyle(raw[key]);
      });
      sheet = StyleSheet.create(raw);
      builtFor = version;
    }
    return sheet;
  };
  return new Proxy(
    {},
    {
      get: (_, key) => resolve()[key],
      has: (_, key) => key in resolve(),
      ownKeys: () => Reflect.ownKeys(resolve()),
      getOwnPropertyDescriptor: (_, key) => {
        const d = Object.getOwnPropertyDescriptor(resolve(), key);
        return d ? { ...d, configurable: true } : d;
      },
    }
  );
}
