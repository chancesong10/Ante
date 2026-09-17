// Content-integrity coverage for the tracker guides.
//
// The guide data is plain JSON-ish config that nothing type-checks, and two
// kinds of typo in it fail in ways you'd only find by tapping through all six
// trackers on a device:
//   - a payoff route that isn't a real navigator route throws on navigate
//   - an `art` key with no illustration silently falls back to the wrong one
// Both are cheap to assert here instead.

const fs = require('fs');
const path = require('path');

const { TRACKER_GUIDES, guideForGame } = require('../trackerGuides');

// The games that actually have trackers, and therefore need a guide. Kept as
// a literal rather than derived from the guides themselves, so deleting a
// game's content by accident fails instead of shrinking the expectation.
const TRACKED_GAMES = ['Blackjack', 'Poker', 'Sports Betting', 'Roulette', 'Baccarat', 'General'];

// Art keys, read out of the component's source rather than by importing it —
// GuideArt pulls in react-native, which this suite has no need to render.
function artKeysFromSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'components', 'GuideArt.js'), 'utf8');
  const block = source.slice(source.indexOf('export const ARTS = {'));
  const body = block.slice(0, block.indexOf('};'));
  return [...body.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
}

// Route names as registered in the navigator.
function routeNamesFromApp() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'App.js'), 'utf8');
  return [...source.matchAll(/name="([A-Za-z]+)"/g)].map((m) => m[1]);
}

describe('tracker guide content', () => {
  test('every tracked game has a guide', () => {
    TRACKED_GAMES.forEach((game) => {
      expect(guideForGame(game)).toBeTruthy();
    });
  });

  test('guideForGame returns null for an unknown game rather than throwing', () => {
    expect(guideForGame('Craps')).toBeNull();
    expect(guideForGame(undefined)).toBeNull();
  });

  test('no guide exists for a game with no tracker', () => {
    Object.keys(TRACKER_GUIDES).forEach((game) => {
      expect(TRACKED_GAMES).toContain(game);
    });
  });

  test('every art key a panel asks for has an illustration', () => {
    const available = artKeysFromSource();
    expect(available.length).toBeGreaterThan(0);
    Object.entries(TRACKER_GUIDES).forEach(([game, guide]) => {
      guide.panels.forEach((panel, i) => {
        expect(available).toContain(panel.art);
        if (!available.includes(panel.art)) {
          throw new Error(`${game} panel ${i} wants art "${panel.art}"`);
        }
      });
    });
  });

  test('every payoff route is a real navigator route', () => {
    const routes = routeNamesFromApp();
    expect(routes).toContain('Insights');
    Object.entries(TRACKER_GUIDES).forEach(([game, guide]) => {
      guide.panels.forEach((panel) => {
        if (!panel.payoff) return;
        expect(routes).toContain(panel.payoff.route);
        if (!routes.includes(panel.payoff.route)) {
          throw new Error(`${game} payoff points at unknown route "${panel.payoff.route}"`);
        }
      });
    });
  });

  test('each guide ends on a payoff panel, and only the last panel has one', () => {
    Object.entries(TRACKER_GUIDES).forEach(([game, guide]) => {
      const withPayoff = guide.panels.filter((p) => p.payoff);
      expect(withPayoff).toHaveLength(1);
      expect(guide.panels[guide.panels.length - 1].payoff).toBeTruthy();
      expect(guide.panels[guide.panels.length - 1].payoff.stats.length).toBeGreaterThan(0);
      if (!guide.panels[guide.panels.length - 1].payoff) {
        throw new Error(`${game} does not end on a payoff panel`);
      }
    });
  });

  test('panels carry the copy the sheet renders, and stay short enough to read', () => {
    Object.values(TRACKER_GUIDES).forEach((guide) => {
      expect(guide.panels.length).toBeGreaterThanOrEqual(2);
      guide.panels.forEach((panel) => {
        expect(typeof panel.heading).toBe('string');
        expect(panel.heading.length).toBeGreaterThan(0);
        expect(panel.heading.length).toBeLessThanOrEqual(46);
        expect(typeof panel.body).toBe('string');
        // Past roughly this length the body starts pushing the footer off a
        // small screen, which is the failure the sheet can't recover from.
        expect(panel.body.length).toBeLessThanOrEqual(170);
        (panel.points || []).forEach((point) => {
          expect(typeof point).toBe('string');
          expect(point.length).toBeLessThanOrEqual(80);
        });
      });
    });
  });

  test('every guide names a theme colour token for its accent', () => {
    // Read as source for the same reason as the art keys — no RN import here.
    const theme = fs.readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
    Object.entries(TRACKER_GUIDES).forEach(([game, guide]) => {
      expect(typeof guide.accent).toBe('string');
      expect(theme).toContain(`${guide.accent}:`);
      if (!theme.includes(`${guide.accent}:`)) {
        throw new Error(`${game} accent "${guide.accent}" is not a COLORS token`);
      }
    });
  });
});
