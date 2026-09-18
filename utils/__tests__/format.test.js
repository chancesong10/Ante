import { formatNumber, formatAmount, formatMoney } from '../format';

describe('money formatting', () => {
  test('formatNumber adds thousands separators at a fixed precision', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
    expect(formatNumber(1234567.891, 0)).toBe('1,234,568');
    expect(formatNumber(undefined)).toBe('0.00');
  });

  test('formatAmount keeps whole amounts whole and cents to two places', () => {
    expect(formatAmount(1000)).toBe('1,000');
    expect(formatAmount('2500')).toBe('2,500');
    expect(formatAmount(12.5)).toBe('12.50');
    expect(formatAmount(null)).toBe('0');
  });

  test('formatMoney signs, separates, and respects privacy mode', () => {
    expect(formatMoney(-1234.5)).toBe('−$1,234.50');
    expect(formatMoney(1234.5, '$', true)).toBe('••••');
  });

  // ProfileScreen used to define a local formatAmount that prepended the
  // currency symbol, shadowing this one. The stop-loss row supplies its own
  // symbol and so rendered '$$250.00'. These two pin the split that made the
  // shadowing a visible bug rather than harmless duplication.
  test('formatAmount returns a bare number, formatMoney carries the symbol', () => {
    expect(formatAmount(250)).toBe('250');
    expect(formatAmount(250)).not.toContain('$');
    expect(formatMoney(250, '$', false, { signed: false })).toBe('$250.00');
  });

  test('formatMoney omits the sign at zero and when signed is off', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(12.5, '$', false, { signed: false })).toBe('$12.50');
  });
});
