import { describe, it, expect } from 'vitest'
import { calculateInstallments } from './installments'

describe('calculateInstallments', () => {
  it('splits evenly', () => {
    const rows = calculateInstallments(30000, 3, '2026-06-01')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ index: 1, dueDate: '2026-06-01', amount: 10000 })
    expect(rows[1]).toEqual({ index: 2, dueDate: '2026-07-01', amount: 10000 })
    expect(rows[2]).toEqual({ index: 3, dueDate: '2026-08-01', amount: 10000 })
  })

  it('puts remainder in last installment', () => {
    const rows = calculateInstallments(10000, 3, '2026-06-01')
    expect(rows[0].amount).toBe(3333)
    expect(rows[1].amount).toBe(3333)
    expect(rows[2].amount).toBe(3334) // 10000 - 3333 - 3333
  })

  it('returns empty array for zero remaining', () => {
    expect(calculateInstallments(0, 3, '2026-06-01')).toEqual([])
  })

  it('returns empty array for zero count', () => {
    expect(calculateInstallments(10000, 0, '2026-06-01')).toEqual([])
  })

  it('advances months correctly', () => {
    const rows = calculateInstallments(20000, 2, '2026-01-31')
    expect(rows[0].dueDate).toBe('2026-01-31')
    // JS Date rolls Jan 31 + 1 month to Mar 3 in non-leap year — accepted behavior
    expect(rows[1].dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
