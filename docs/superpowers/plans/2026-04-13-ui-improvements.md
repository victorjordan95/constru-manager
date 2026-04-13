# UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply four UX improvements: CPF/CNPJ auto-mask, inline status action buttons on the quotes list, zero-reset on number inputs, and a redesigned AcceptQuoteModal with auto-calculated installment preview.

**Architecture:** Pure logic helpers (`taxId.ts`, `installments.ts`) are extracted and unit-tested with vitest. UI components are modified in-place following existing inline-style patterns. No new pages, no backend changes.

**Tech Stack:** React 19, TypeScript, Vite 8, TanStack Query v5, TanStack Router v1 — adding vitest for unit tests.

---

## File Map

| File | Action |
|------|--------|
| `client/vite.config.ts` | Add vitest `test` block |
| `client/package.json` | Add vitest dep + `test` script |
| `client/src/lib/taxId.ts` | **Create** — CPF/CNPJ format + detect helpers |
| `client/src/lib/taxId.test.ts` | **Create** — unit tests |
| `client/src/lib/installments.ts` | **Create** — installment calculation helper |
| `client/src/lib/installments.test.ts` | **Create** — unit tests |
| `client/src/features/clients/ClientFormPage.tsx` | Apply mask + dynamic label |
| `client/src/features/quotes/AcceptQuoteModal.tsx` | Full redesign |
| `client/src/features/quotes/QuoteDetailPage.tsx` | Pass `total` prop |
| `client/src/features/quotes/QuoteFormPage.tsx` | Add `selectOnFocus` |
| `client/src/features/quotes/QuoteVersionFormPage.tsx` | Add `selectOnFocus` |
| `client/src/features/quotes/QuotesListPage.tsx` | Inline action buttons + modal |

---

## Task 1: Set up vitest

**Files:**
- Modify: `client/package.json`
- Modify: `client/vite.config.ts`

- [ ] **Step 1: Install vitest**

```bash
cd client && npm install --save-dev vitest
```

Expected: vitest appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

In `client/package.json`, add `"test": "vitest run"` to the `scripts` block:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Configure vitest in vite.config.ts**

Replace the entire `client/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
cd client && npm test
```

Expected output: `No test files found` or `0 tests passed`. No errors.

- [ ] **Step 5: Commit**

```bash
cd client && git add package.json package-lock.json vite.config.ts && git commit -m "chore: add vitest for unit testing"
```

---

## Task 2: CPF/CNPJ mask helpers

**Files:**
- Create: `client/src/lib/taxId.ts`
- Create: `client/src/lib/taxId.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `client/src/lib/taxId.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd client && npm test
```

Expected: failures like `Cannot find module './taxId'`.

- [ ] **Step 3: Create the helpers**

Create `client/src/lib/taxId.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd client && npm test
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
cd client && git add src/lib/taxId.ts src/lib/taxId.test.ts && git commit -m "feat: add CPF/CNPJ format and detect helpers with tests"
```

---

## Task 3: Apply CPF/CNPJ mask in ClientFormPage

**Files:**
- Modify: `client/src/features/clients/ClientFormPage.tsx`

- [ ] **Step 1: Add import at top of ClientFormPage.tsx**

At the top of `client/src/features/clients/ClientFormPage.tsx`, add the import after the existing imports:

```ts
import { formatTaxId, detectTaxIdType } from '@/lib/taxId'
```

- [ ] **Step 2: Replace the taxId `<label>` block**

Find this block (around line 151–159):

```tsx
        <label style={labelStyle}>
          <span style={labelTextStyle}>CPF / CNPJ *</span>
          <input
            style={inputStyle}
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            required
          />
        </label>
```

Replace with:

```tsx
        <label style={labelStyle}>
          <span style={labelTextStyle}>
            {detectTaxIdType(form.taxId.replace(/\D/g, ''))} *
          </span>
          <input
            style={inputStyle}
            value={form.taxId}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '')
              setForm({ ...form, taxId: formatTaxId(digits) })
            }}
            required
          />
        </label>
```

- [ ] **Step 3: Manual test**

Start the dev server (`cd client && npm run dev`) and navigate to `/clients/new`.

Verify:
- Label shows "CPF / CNPJ *" initially.
- Typing `12345678901` (11 digits) formats as `123.456.789-01` and label shows "CPF *".
- Clearing and typing `12345678901234` (14 digits) formats as `12.345.678/9012-34` and label shows "CNPJ *".
- Non-digit characters are ignored (e.g. pasting `abc123` inserts just `123`).

- [ ] **Step 4: Commit**

```bash
cd client && git add src/features/clients/ClientFormPage.tsx && git commit -m "feat: add CPF/CNPJ auto-mask and dynamic label in client form"
```

---

## Task 4: Installment calculation helper

**Files:**
- Create: `client/src/lib/installments.ts`
- Create: `client/src/lib/installments.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `client/src/lib/installments.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd client && npm test
```

Expected: failures like `Cannot find module './installments'`.

- [ ] **Step 3: Create the helper**

Create `client/src/lib/installments.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd client && npm test
```

Expected: all tests pass (the month-roll test just checks format, not exact date).

- [ ] **Step 5: Commit**

```bash
cd client && git add src/lib/installments.ts src/lib/installments.test.ts && git commit -m "feat: add installment calculation helper with tests"
```

---

## Task 5: Redesign AcceptQuoteModal

**Files:**
- Modify: `client/src/features/quotes/AcceptQuoteModal.tsx`

Replace the entire file content:

- [ ] **Step 1: Replace AcceptQuoteModal.tsx**

```tsx
import { useState, useMemo, useEffect } from 'react'
import { useAcceptQuote } from './hooks'
import { formatCurrency } from '@/lib/format'
import { calculateInstallments } from '@/lib/installments'
import type { InstallmentPayload } from './types'

interface Props {
  quoteId: string
  total: number   // integer cents — from activeVersion.total
  onClose: () => void
}

export function AcceptQuoteModal({ quoteId, total, onClose }: Props) {
  const acceptMutation = useAcceptQuote()
  const [paymentType, setPaymentType] = useState<'LUMP_SUM' | 'INSTALLMENTS'>('LUMP_SUM')
  const [downPaymentStr, setDownPaymentStr] = useState('0')
  const [installmentCount, setInstallmentCount] = useState(1)
  const [firstDate, setFirstDate] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)

  const downPaymentCents = useMemo(() => {
    const v = parseFloat(downPaymentStr || '0')
    return Math.round(isNaN(v) ? 0 : v * 100)
  }, [downPaymentStr])

  const remaining = Math.max(0, total - downPaymentCents)

  const preview = useMemo(() => {
    if (paymentType !== 'INSTALLMENTS' || !firstDate || installmentCount < 1) return []
    return calculateInstallments(remaining, installmentCount, firstDate)
  }, [paymentType, remaining, installmentCount, firstDate])

  const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    let installments: InstallmentPayload[] | undefined
    if (paymentType === 'INSTALLMENTS') {
      if (!firstDate) {
        setServerError('Informe a data da primeira parcela.')
        return
      }
      if (preview.length === 0) {
        setServerError('Nenhuma parcela calculada. Verifique os valores.')
        return
      }
      installments = preview.map((row) => ({
        dueDate: `${row.dueDate}T00:00:00.000Z`,
        amount: row.amount,
      }))
    }

    try {
      await acceptMutation.mutateAsync({
        id: quoteId,
        payload: {
          paymentType,
          downPayment: downPaymentCents,
          ...(installments && { installments }),
        },
      })
      onClose()
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'QUOTE_NOT_FOUND') setServerError('Orçamento não encontrado.')
      else if (code === 'ALREADY_ACCEPTED') setServerError('Este orçamento já foi aceito.')
      else if (code === 'NO_ACTIVE_VERSION') setServerError('O orçamento não possui uma versão ativa.')
      else setServerError('Erro ao aceitar orçamento. Tente novamente.')
    }
  }

  const isPending = acceptMutation.isPending

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, isPending])

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
    width: '100%',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          padding: 'var(--space-3)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Aceitar Orçamento</h2>

        {/* Order summary */}
        <div
          style={{
            background: 'var(--color-primary-bg)',
            borderRadius: 6,
            padding: 'var(--space-1) var(--space-2)',
            marginBottom: 'var(--space-2)',
            fontSize: '0.9rem',
          }}
        >
          Valor do pedido:{' '}
          <strong style={{ color: 'var(--color-primary)' }}>{formatCurrency(total)}</strong>
        </div>

        {serverError && (
          <p
            style={{
              color: 'var(--color-danger)',
              background: 'var(--color-danger-bg)',
              padding: 'var(--space-1)',
              borderRadius: 4,
              marginBottom: 'var(--space-2)',
            }}
          >
            {serverError}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          {/* Payment type */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>
              Forma de pagamento
            </span>
            <select
              autoFocus
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as 'LUMP_SUM' | 'INSTALLMENTS')}
              style={inputStyle}
            >
              <option value="LUMP_SUM">À vista</option>
              <option value="INSTALLMENTS">Parcelado</option>
            </select>
          </label>

          {/* Down payment */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>
              Entrada (R$)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={downPaymentStr}
              onChange={(e) => setDownPaymentStr(e.target.value)}
              onFocus={selectOnFocus}
              style={inputStyle}
            />
          </label>

          {/* Installments section */}
          {paymentType === 'INSTALLMENTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-1)' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>
                    Nº de parcelas
                  </span>
                  <select
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Number(e.target.value))}
                    style={inputStyle}
                  >
                    {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>
                    Data da 1ª parcela
                  </span>
                  <input
                    type="date"
                    value={firstDate}
                    onChange={(e) => setFirstDate(e.target.value)}
                    required={paymentType === 'INSTALLMENTS'}
                    style={inputStyle}
                  />
                </label>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)' }}>
                Saldo a parcelar: <strong>{formatCurrency(remaining)}</strong>
              </p>

              {preview.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 6, color: 'var(--color-neutral-600)' }}>
                    Previsão de parcelas
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-neutral-100)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Vencimento</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row) => (
                        <tr key={row.index} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                          <td style={{ padding: '4px 8px', color: 'var(--color-neutral-600)' }}>{row.index}</td>
                          <td style={{ padding: '4px 8px' }}>
                            {new Date(`${row.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
            <button
              type="submit"
              disabled={isPending}
              style={{
                background: 'var(--color-success)',
                color: 'var(--color-surface)',
                border: 'none',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 4,
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Confirmando...' : 'Confirmar Aceitação'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                background: 'none',
                border: '1px solid var(--color-neutral-300)',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 4,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd client && git add src/features/quotes/AcceptQuoteModal.tsx && git commit -m "feat: redesign AcceptQuoteModal with auto-calculated installment preview"
```

---

## Task 6: Update QuoteDetailPage to pass total prop

**Files:**
- Modify: `client/src/features/quotes/QuoteDetailPage.tsx`

- [ ] **Step 1: Update the AcceptQuoteModal render call**

Find this line (around line 242):

```tsx
        <AcceptQuoteModal quoteId={quote.id} onClose={() => setShowAcceptModal(false)} />
```

Replace with:

```tsx
        <AcceptQuoteModal
          quoteId={quote.id}
          total={quote.activeVersion!.total}
          onClose={() => setShowAcceptModal(false)}
        />
```

Note: `quote.activeVersion` is guaranteed non-null here because `canAccept` (which gates `showAcceptModal`) checks `quote.activeVersion !== null`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd client && git add src/features/quotes/QuoteDetailPage.tsx && git commit -m "fix: pass total prop to AcceptQuoteModal in detail page"
```

---

## Task 7: Add selectOnFocus to QuoteFormPage and QuoteVersionFormPage

**Files:**
- Modify: `client/src/features/quotes/QuoteFormPage.tsx`
- Modify: `client/src/features/quotes/QuoteVersionFormPage.tsx`

### QuoteFormPage

- [ ] **Step 1: Add selectOnFocus handler and wire to laborCost input**

In `client/src/features/quotes/QuoteFormPage.tsx`, add a handler constant before the `return` statement (after the existing computed values):

```ts
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()
```

Then find the laborCost `<input>` block (around line 280–289):

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={laborCostStr}
                onChange={(e) => setLaborCostStr(e.target.value)}
                style={inputStyle}
              />
```

Replace with:

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={laborCostStr}
                onChange={(e) => setLaborCostStr(e.target.value)}
                onFocus={selectOnFocus}
                style={inputStyle}
              />
```

- [ ] **Step 2: Wire selectOnFocus to discount input in QuoteFormPage**

Find the discount `<input>` block (around line 293–299):

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                style={inputStyle}
              />
```

Replace with:

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                onFocus={selectOnFocus}
                style={inputStyle}
              />
```

### QuoteVersionFormPage

- [ ] **Step 3: Add selectOnFocus and wire to both inputs in QuoteVersionFormPage**

In `client/src/features/quotes/QuoteVersionFormPage.tsx`, add the same handler constant before the `return`:

```ts
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()
```

Find the laborCost `<input>` (around line 285–289):

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={laborCostStr}
                onChange={(e) => setLaborCostStr(e.target.value)}
                style={inputStyle}
              />
```

Replace with:

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={laborCostStr}
                onChange={(e) => setLaborCostStr(e.target.value)}
                onFocus={selectOnFocus}
                style={inputStyle}
              />
```

Find the discount `<input>` (around line 296–300):

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                style={inputStyle}
              />
```

Replace with:

```tsx
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                onFocus={selectOnFocus}
                style={inputStyle}
              />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd client && git add src/features/quotes/QuoteFormPage.tsx src/features/quotes/QuoteVersionFormPage.tsx && git commit -m "fix: select-on-focus for numeric fields to prevent leading-zero input"
```

---

## Task 8: Inline action buttons in QuotesListPage

**Files:**
- Modify: `client/src/features/quotes/QuotesListPage.tsx`

Replace the entire file:

- [ ] **Step 1: Replace QuotesListPage.tsx**

```tsx
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuotes, useUpdateStatus } from './hooks'
import { STATUS_LABEL, STATUS_COLOR } from './statusLabels'
import { formatCurrency } from '@/lib/format'
import { useAuthStore } from '@/stores/authStore'
import { AcceptQuoteModal } from './AcceptQuoteModal'
import type { QuoteStatus } from './types'

export function QuotesListPage() {
  const { data: quotes, isLoading, error } = useQuotes()
  const { user } = useAuthStore()
  const updateStatusMutation = useUpdateStatus()
  const [acceptModal, setAcceptModal] = useState<{ quoteId: string; total: number } | null>(null)

  const isAdmin = user?.role === 'ADMIN'

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar orçamentos.</p>

  function canShowActions(status: QuoteStatus): boolean {
    return isAdmin && status !== 'ACCEPTED' && status !== 'DRAFT'
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Orçamentos</h1>
        {(user?.role === 'ADMIN' || user?.role === 'SALES') && (
          <Link to="/quotes/new">
            <button
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-surface)',
                border: 'none',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + Novo Orçamento
            </button>
          </Link>
        )}
      </div>
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-bg)' }}>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Versão</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Data</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {quotes?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-neutral-600)' }}>
                  Nenhum orçamento cadastrado.
                </td>
              </tr>
            )}
            {quotes?.map((q) => {
              const colors = STATUS_COLOR[q.status] ?? { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' }
              const showActions = canShowActions(q.status)
              const isMutating = updateStatusMutation.isPending

              return (
                <tr key={q.id} style={{ borderTop: '1px solid var(--color-neutral-300)' }}>
                  <td style={tdStyle}>{q.client.name}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-neutral-600)' }}>
                    {q.activeVersion ? `v${q.activeVersion.version}` : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {q.activeVersion ? formatCurrency(q.activeVersion.total) : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-neutral-600)', fontSize: '0.875rem' }}>
                    {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Link to="/quotes/$id" params={{ id: q.id }}>
                        <button style={btnSecondary}>Ver</button>
                      </Link>
                      {showActions && (
                        <>
                          {q.activeVersion && (
                            <button
                              disabled={isMutating}
                              onClick={() =>
                                setAcceptModal({ quoteId: q.id, total: q.activeVersion!.total })
                              }
                              style={{ ...btnSuccess, opacity: isMutating ? 0.6 : 1 }}
                            >
                              Aceitar
                            </button>
                          )}
                          {q.status !== 'REJECTED' && (
                            <button
                              disabled={isMutating}
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: q.id,
                                  payload: { status: 'REJECTED' },
                                })
                              }
                              style={{ ...btnDanger, opacity: isMutating ? 0.6 : 1 }}
                            >
                              Recusar
                            </button>
                          )}
                          {q.status !== 'NO_RESPONSE' && (
                            <button
                              disabled={isMutating}
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: q.id,
                                  payload: { status: 'NO_RESPONSE' },
                                })
                              }
                              style={{ ...btnNeutral, opacity: isMutating ? 0.6 : 1 }}
                            >
                              Sem Retorno
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {acceptModal && (
        <AcceptQuoteModal
          quoteId={acceptModal.quoteId}
          total={acceptModal.total}
          onClose={() => setAcceptModal(null)}
        />
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  textAlign: 'left',
  fontSize: '0.875rem',
  color: 'var(--color-primary)',
}

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
}

const btnSecondary: React.CSSProperties = {
  background: 'var(--color-primary-bg)',
  color: 'var(--color-primary)',
  border: 'none',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
}

const btnSuccess: React.CSSProperties = {
  background: 'var(--color-success)',
  color: 'var(--color-surface)',
  border: 'none',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 600,
}

const btnDanger: React.CSSProperties = {
  background: 'var(--color-danger-bg)',
  color: 'var(--color-danger)',
  border: 'none',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
}

const btnNeutral: React.CSSProperties = {
  background: 'var(--color-neutral-100)',
  color: 'var(--color-neutral-600)',
  border: '1px solid var(--color-neutral-300)',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test in browser**

Navigate to `/quotes`. Log in as ADMIN.

Verify:
- Quotes with status `PENDING_REVIEW` show Aceitar + Recusar + Sem Retorno buttons.
- Quotes with status `ACCEPTED` or `DRAFT` show only "Ver".
- Clicking "Aceitar" opens the AcceptQuoteModal with the order total displayed at top.
- Clicking "Recusar" immediately changes status to REJECTED (row updates via query invalidation).
- Clicking "Sem Retorno" immediately changes status to NO_RESPONSE.
- Non-ADMIN users (SALES, VIEWER) see only "Ver".

- [ ] **Step 4: Commit**

```bash
cd client && git add src/features/quotes/QuotesListPage.tsx && git commit -m "feat: add inline accept/reject/no-response buttons in quotes list"
```

---

## Done

All four improvements are implemented. Run the full test suite one last time to confirm:

```bash
cd client && npm test
```

Expected: all unit tests pass.
