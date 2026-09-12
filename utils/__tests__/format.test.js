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
});
