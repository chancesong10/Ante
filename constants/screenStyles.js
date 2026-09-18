import { StyleSheet } from 'react-native';
import { COLORS } from './theme';

// Screen-shell styles that were byte-identical everywhere they appeared.
//
// Only the keys that genuinely agreed are here. The other repeated names have
// drifted into real differences and are deliberately NOT collected:
//
//   card     15 definitions, 7 variants — borderRadius 16 / 18 / RADIUS.md /
//            RADIUS.lg, with three different margins. Picking one is a design
//            decision with visible consequences on eleven screens, not a
//            mechanical merge.
//   topNav   11 definitions, 2 variants — the table trackers pad differently.
//   backBtn   7 definitions, 2 variants — AntePlus is deliberately a
//            translucent overlay button rather than a card-coloured one.
//
// So: add to this file only when a style is the same everywhere it is used.
// A shared style that needs a per-screen override is not shared, it is a
// default with exceptions, and those are harder to reason about than the
// duplication they replace.
export const screenStyles = StyleSheet.create({
  // The root of a screen, and the SafeAreaView variant of the same thing.
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  navTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
