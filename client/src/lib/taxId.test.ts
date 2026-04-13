import { describe, it, expect } from 'vitest'
import { formatTaxId, detectTaxIdType } from './taxId'

describe('formatTaxId', () => {
  it('formats partial CPF', () => {
    expect(formatTaxId('123')).toBe('123')
    expect(formatTaxId('1234')).toBe('123.4')
    expect(formatTaxId('1234567')).toBe('123.456.7')
  })

  it('formats full CPF', () => {
    expect(formatTaxId('12345678901')).toBe('123.456.789-01')
  })

  it('formats partial CNPJ', () => {
    expect(formatTaxId('123456789012')).toBe('12.345.678/9012')
    expect(formatTaxId('1234567890123')).toBe('12.345.678/9012-3')
  })

  it('formats full CNPJ', () => {
    expect(formatTaxId('12345678901234')).toBe('12.345.678/9012-34')
  })

  it('ignores extra digits beyond 14', () => {
    expect(formatTaxId('123456789012345')).toBe('12.345.678/9012-34')
  })
})

describe('detectTaxIdType', () => {
  it('returns CPF / CNPJ when ambiguous', () => {
    expect(detectTaxIdType('')).toBe('CPF / CNPJ')
    expect(detectTaxIdType('12345678')).toBe('CPF / CNPJ')
  })

  it('returns CPF for 11 digits', () => {
    expect(detectTaxIdType('12345678901')).toBe('CPF')
  })

  it('returns CNPJ for 12+ digits', () => {
    expect(detectTaxIdType('123456789012')).toBe('CNPJ')
    expect(detectTaxIdType('12345678901234')).toBe('CNPJ')
  })
})
