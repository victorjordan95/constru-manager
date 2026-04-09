import { computeKitTotalPriceFromMap } from './kits.service';

describe('computeKitTotalPriceFromMap', () => {
  it('sums quantity × finalPrice for each item', () => {
    const priceMap = new Map([
      ['prod-1', 10000],
      ['prod-2', 5000],
    ]);
    const items = [
      { productId: 'prod-1', quantity: 2 },
      { productId: 'prod-2', quantity: 3 },
    ];
    // (10000 × 2) + (5000 × 3) = 20000 + 15000 = 35000
    expect(computeKitTotalPriceFromMap(items, priceMap)).toBe(35000);
  });

  it('returns 0 for an empty items array', () => {
    expect(computeKitTotalPriceFromMap([], new Map())).toBe(0);
  });

  it('treats unknown productId as 0 price', () => {
    const priceMap = new Map([['prod-1', 10000]]);
    expect(computeKitTotalPriceFromMap([{ productId: 'unknown', quantity: 5 }], priceMap)).toBe(0);
  });
});
