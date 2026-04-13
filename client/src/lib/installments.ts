export interface InstallmentPreview {
  index: number    // 1-based
  dueDate: string  // "YYYY-MM-DD"
  amount: number   // integer cents
}

/**
 * Calculate equal monthly installments for a given remaining amount.
 * The last installment absorbs any rounding remainder.
 *
 * @param remaining - total amount in cents to split
 * @param count     - number of installments (must be >= 1)
 * @param firstDate - "YYYY-MM-DD" date of first installment
 */
export function calculateInstallments(
  remaining: number,
  count: number,
  firstDate: string,
): InstallmentPreview[] {
  if (count <= 0 || remaining <= 0) return []

  const base = Math.floor(remaining / count)
  const remainder = remaining - base * count

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(`${firstDate}T12:00:00`)
    d.setMonth(d.getMonth() + i)
    const dueDate = d.toISOString().slice(0, 10)
    const amount = i === count - 1 ? base + remainder : base
    return { index: i + 1, dueDate, amount }
  })
}
