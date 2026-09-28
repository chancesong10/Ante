// Ante's typefaces.
//
// Figtree for everything — rounded-geometric and friendly, and unlike most
// rounded faces it has true tabular figures, which the money columns need.
// Fraunces, a soft serif, for screen titles only: it is what makes a page
// feel like a notebook rather than a dashboard.
//
// Custom fonts on Android ignore `fontWeight` — each weight is a separate
// family — so screens never name a font file. They write `fontWeight` as
// usual (and `fontFamily: 'display'` for a title), and `resolveFontStyle`,
// which every themed stylesheet runs through, swaps that for the right file.

export const FONT_FILES = {
  Figtree_400Regular: require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf'),
  Figtree_500Medium: require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
  Figtree_600SemiBold: require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
  Figtree_700Bold: require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
  Figtree_800ExtraBold: require('@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf'),
  Fraunces_500Medium: require('@expo-google-fonts/fraunces/500Medium/Fraunces_500Medium.ttf'),
  Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf'),
};

const FAMILIES = {
  text: {
    400: 'Figtree_400Regular',
    500: 'Figtree_500Medium',
    600: 'Figtree_600SemiBold',
    700: 'Figtree_700Bold',
    800: 'Figtree_800ExtraBold',
  },
  display: {
    400: 'Fraunces_500Medium',
    500: 'Fraunces_500Medium',
    600: 'Fraunces_600SemiBold',
    700: 'Fraunces_600SemiBold',
    800: 'Fraunces_600SemiBold',
  },
};

const weightOf = (w) => {
  if (w === 'bold') return 700;
  const n = parseInt(w, 10);
  if (!n) return 400;
  return Math.min(800, Math.max(400, Math.round(n / 100) * 100));
};

// The family file for a weight, for the rare inline style outside a sheet.
export const fontFor = (weight = '400', family = 'text') => FAMILIES[family][weightOf(weight)];

// Given one style entry, returns it with our font applied — only to text
// styles (those that set a size or weight) and only where no other family
// was chosen deliberately (e.g. the monospace recovery phrase).
export function resolveFontStyle(style) {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;
  const family = style.fontFamily;
  const isOurs = family === undefined || family === 'display';
  if (!isOurs || (family === undefined && !('fontSize' in style) && !('fontWeight' in style))) {
    return style;
  }
  const { fontWeight, ...rest } = style;
  return { ...rest, fontFamily: fontFor(fontWeight, family === 'display' ? 'display' : 'text') };
}
