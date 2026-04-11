import { computeVersionTotals } from './quotes.service'

describe('computeVersionTotals', () => {
  it('sums line totals and adds laborCost, subtracts discount', () => {
    // subtotal = 10000 + 5000 = 15000; total = 15000 + 2000 - 500 = 16500
    expect(computeVersionTotals([10000, 5000], 2000, 500)).toEqual({
      subtotal: 15000,
      total: 16500,
    })
  })

  it('returns 0 for empty items with no extra costs', () => {
    expect(computeVersionTotals([], 0, 0)).toEqual({ subtotal: 0, total: 0 })
  })

  it('handles zero laborCost and zero discount', () => {
    expect(computeVersionTotals([8000], 0, 0)).toEqual({ subtotal: 8000, total: 8000 })
  })

  it('allows discount larger than subtotal (negative total)', () => {
    expect(computeVersionTotals([1000], 0, 2000)).toEqual({ subtotal: 1000, total: -1000 })
  })
})
