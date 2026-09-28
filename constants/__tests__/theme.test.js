jest.mock('react-native', () => ({
  StyleSheet: { create: (s) => s },
}));

const {
  COLORS,
  GAME_COLORS,
  PALETTES,
  getColorScheme,
  setColorScheme,
  subscribeColorScheme,
  themed,
} = require('../theme');
const { resolveFontStyle, fontFor } = require('../fonts');

afterEach(() => setColorScheme('light'));

describe('live palette', () => {
  it('reads through to whichever scheme is active', () => {
    setColorScheme('light');
    expect(COLORS.background).toBe(PALETTES.light.background);
    setColorScheme('dark');
    expect(COLORS.background).toBe(PALETTES.dark.background);
    expect(getColorScheme()).toBe('dark');
  });

  it('gives both palettes exactly the same tokens', () => {
    expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
  });

  it('switches game colours with the palette', () => {
    setColorScheme('light');
    const light = GAME_COLORS.Poker;
    setColorScheme('dark');
    expect(GAME_COLORS.Poker).not.toBe(light);
  });

  it('ignores unknown schemes and notifies only on a real change', () => {
    const seen = [];
    const unsubscribe = subscribeColorScheme((s) => seen.push(s));
    setColorScheme('light');
    setColorScheme('sepia');
    setColorScheme('dark');
    unsubscribe();
    setColorScheme('light');
    expect(seen).toEqual(['dark']);
  });
});

describe('themed stylesheets', () => {
  it('rebuilds after the scheme changes, and only then', () => {
    const factory = jest.fn(() => ({ page: { backgroundColor: COLORS.background } }));
    const styles = themed(factory);
    expect(factory).not.toHaveBeenCalled();

    expect(styles.page.backgroundColor).toBe(PALETTES.light.background);
    expect(styles.page.backgroundColor).toBe(PALETTES.light.background);
    expect(factory).toHaveBeenCalledTimes(1);

    setColorScheme('dark');
    expect(styles.page.backgroundColor).toBe(PALETTES.dark.background);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('spreads and enumerates like a plain object', () => {
    const styles = themed(() => ({ a: { flex: 1 }, b: { flex: 2 } }));
    expect(Object.keys(styles)).toEqual(['a', 'b']);
    expect({ ...styles }.b).toEqual({ flex: 2 });
  });
});

describe('fonts', () => {
  it('turns a weight into the matching family file and drops fontWeight', () => {
    expect(resolveFontStyle({ fontSize: 14, fontWeight: '700' })).toEqual({
      fontSize: 14,
      fontFamily: 'Figtree_700Bold',
    });
    expect(resolveFontStyle({ fontSize: 14 }).fontFamily).toBe('Figtree_400Regular');
  });

  it('uses the display serif when asked', () => {
    expect(resolveFontStyle({ fontFamily: 'display', fontSize: 20, fontWeight: '600' }).fontFamily).toBe(
      'Fraunces_600SemiBold'
    );
  });

  it('leaves non-text styles and deliberately chosen families alone', () => {
    const box = { flex: 1, padding: 4 };
    expect(resolveFontStyle(box)).toBe(box);
    const mono = { fontFamily: 'monospace', fontSize: 12, fontWeight: '600' };
    expect(resolveFontStyle(mono)).toBe(mono);
  });

  it('clamps weights to the files that ship', () => {
    expect(fontFor('900')).toBe('Figtree_800ExtraBold');
    expect(fontFor('300')).toBe('Figtree_400Regular');
    expect(fontFor('bold')).toBe('Figtree_700Bold');
  });
});
