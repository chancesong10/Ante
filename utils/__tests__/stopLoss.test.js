import { lossTier, shouldRaiseStopLossAlert, acknowledgedTier } from '../stopLoss';

const opts = { enabled: true, threshold: 250 };

describe('lossTier', () => {
  test('is 0 until the threshold is actually reached', () => {
    expect(lossTier(0, 250)).toBe(0);
    expect(lossTier(-249.99, 250)).toBe(0);
    expect(lossTier(-250, 250)).toBe(1);
  });

  test('counts multiples of the threshold', () => {
    expect(lossTier(-500, 250)).toBe(2);
    expect(lossTier(-749, 250)).toBe(2);
    expect(lossTier(-750, 250)).toBe(3);
  });

  test('a session in profit is never in a tier', () => {
    expect(lossTier(1000, 250)).toBe(0);
  });

  test('a missing or nonsense threshold cannot raise a tier', () => {
    expect(lossTier(-1000, 0)).toBe(0);
    expect(lossTier(-1000, -250)).toBe(0);
    expect(lossTier(-1000, undefined)).toBe(0);
    expect(lossTier(NaN, 250)).toBe(0);
  });
});

describe('shouldRaiseStopLossAlert', () => {
  test('raises the first time losses cross the threshold', () => {
    expect(shouldRaiseStopLossAlert({}, { netOutcome: -250 }, opts)).toBe(true);
  });

  test('stays quiet at the tier already acknowledged', () => {
    const session = { alertedTier: 1 };
    expect(shouldRaiseStopLossAlert(session, { netOutcome: -250 }, opts)).toBe(false);
    expect(shouldRaiseStopLossAlert(session, { netOutcome: -499 }, opts)).toBe(false);
  });

  test('speaks again only once losses deepen past the next threshold', () => {
    expect(shouldRaiseStopLossAlert({ alertedTier: 1 }, { netOutcome: -500 }, opts)).toBe(true);
  });

  // The bug this replaced: the acknowledged tier lived in component state, so
  // a session restored after the app was killed came back with nothing
  // recorded and re-alerted from tier zero — for a warning already dismissed.
  test('an acknowledgement carried on the restored session stays acknowledged', () => {
    const restored = { id: 'a', alertedTier: 3 };
    expect(shouldRaiseStopLossAlert(restored, { netOutcome: -800 }, opts)).toBe(false);
  });

  test('does nothing when the alert is switched off', () => {
    expect(shouldRaiseStopLossAlert({}, { netOutcome: -10000 }, { enabled: false, threshold: 250 })).toBe(false);
  });

  test('tolerates a session with no metrics recorded yet', () => {
    expect(shouldRaiseStopLossAlert({}, undefined, opts)).toBe(false);
  });
});

describe('acknowledgedTier', () => {
  test('records the tier reached at the moment of acknowledgement', () => {
    expect(acknowledgedTier(-640, 250)).toBe(2);
    expect(acknowledgedTier(-100, 250)).toBe(0);
  });
});
