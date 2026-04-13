/**
 * Format a string of raw digits as CPF (≤11 digits) or CNPJ (12–14 digits).
 * Input must contain only digits. Extra digits beyond 14 are ignored.
 */
export function formatTaxId(digits: string): string {
  const d = digits.slice(0, 14)
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)]
    if (d.length <= 3) return p[0]
    if (d.length <= 6) return `${p[0]}.${p[1]}`
    if (d.length <= 9) return `${p[0]}.${p[1]}.${p[2]}`
    return `${p[0]}.${p[1]}.${p[2]}-${p[3]}`
  }
  // CNPJ: 00.000.000/0000-00
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)]
  if (d.length <= 2) return p[0]
  if (d.length <= 5) return `${p[0]}.${p[1]}`
  if (d.length <= 8) return `${p[0]}.${p[1]}.${p[2]}`
  if (d.length <= 12) return `${p[0]}.${p[1]}.${p[2]}/${p[3]}`
  return `${p[0]}.${p[1]}.${p[2]}/${p[3]}-${p[4]}`
}

/**
 * Detect whether a string of raw digits is a CPF, CNPJ, or still ambiguous.
 */
export function detectTaxIdType(digits: string): 'CPF' | 'CNPJ' | 'CPF / CNPJ' {
  if (digits.length === 11) return 'CPF'
  if (digits.length >= 12) return 'CNPJ'
  return 'CPF / CNPJ'
}
