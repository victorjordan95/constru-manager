import { computeBalance } from './finance.service';

describe('computeBalance', () => {
  it('returns openingBalance when no transactions', () => {
    expect(computeBalance(50000, [])).toBe(50000);
  });

  it('adds INCOME and subtracts EXPENSE', () => {
    const txs = [
      { type: 'INCOME' as const, amount: 30000 },
      { type: 'INCOME' as const, amount: 20000 },
      { type: 'EXPENSE' as const, amount: 10000 },
    ];
    // 50000 + 30000 + 20000 - 10000 = 90000
    expect(computeBalance(50000, txs)).toBe(90000);
  });

  it('handles zero opening balance', () => {
    const txs = [{ type: 'INCOME' as const, amount: 15000 }];
    expect(computeBalance(0, txs)).toBe(15000);
  });

  it('returns negative when expenses exceed income + opening', () => {
    const txs = [{ type: 'EXPENSE' as const, amount: 5000 }];
    expect(computeBalance(0, txs)).toBe(-5000);
  });
});
