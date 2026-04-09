import { computeFinalPrice } from './products.service';

describe('computeFinalPrice', () => {
  it('applies markup to base price in cents', () => {
    // 100.00 (10000 cents) + 20% = 120.00 (12000 cents)
    expect(computeFinalPrice(10000, 20)).toBe(12000);
  });

  it('returns base price unchanged when markup is 0', () => {
    expect(computeFinalPrice(5000, 0)).toBe(5000);
  });

  it('rounds to nearest cent', () => {
    // 99.99 (9999 cents) + 10% = 109.989 → rounds to 10999
    expect(computeFinalPrice(9999, 10)).toBe(10999);
  });

  it('handles 100% markup (double price)', () => {
    expect(computeFinalPrice(10000, 100)).toBe(20000);
  });
});
