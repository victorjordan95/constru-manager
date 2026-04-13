import { useState, useMemo, useEffect } from 'react'
import { useAcceptQuote } from './hooks'
import { formatCurrency } from '@/lib/format'
import type { InstallmentPayload } from './types'

interface InstallmentRow {
  _key: number
  dueDate: string   // "YYYY-MM-DD" from <input type="date">
  amountStr: string // decimal BRL string
}

const emptyInstRow = (key: number): InstallmentRow => ({
  _key: key,
  dueDate: '',
  amountStr: '',
})

interface Props {
  quoteId: string
  onClose: () => void
}

export function AcceptQuoteModal({ quoteId, onClose }: Props) {
  const acceptMutation = useAcceptQuote()
  const [paymentType, setPaymentType] = useState<'LUMP_SUM' | 'INSTALLMENTS'>('LUMP_SUM')
  const [downPaymentStr, setDownPaymentStr] = useState('0')
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([emptyInstRow(0)])
  const [nextKey, setNextKey] = useState(1)
  const [serverError, setServerError] = useState<string | null>(null)

  const downPaymentCents = useMemo(() => {
    const v = parseFloat(downPaymentStr || '0')
    return Math.round(isNaN(v) ? 0 : v * 100)
  }, [downPaymentStr])

  const installmentTotal = useMemo(
    () =>
      installmentRows.reduce((sum, row) => {
        const v = parseFloat(row.amountStr || '0')
        return sum + Math.round(isNaN(v) ? 0 : v * 100)
      }, 0),
    [installmentRows],
  )

  function addRow() {
    setInstallmentRows((prev) => [...prev, emptyInstRow(nextKey)])
    setNextKey((k) => k + 1)
  }

  function removeRow(index: number) {
    setInstallmentRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, patch: Partial<Omit<InstallmentRow, '_key'>>) {
    setInstallmentRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    let installments: InstallmentPayload[] | undefined
    if (paymentType === 'INSTALLMENTS') {
      const rows = installmentRows
        .map((row) => {
          const amount = Math.round(parseFloat(row.amountStr || '0') * 100)
          if (!row.dueDate || amount < 1) return null
          return { dueDate: `${row.dueDate}T00:00:00.000Z`, amount }
        })
        .filter((x): x is InstallmentPayload => x !== null)

      if (rows.length === 0) {
        setServerError('Adicione pelo menos uma parcela.')
        return
      }
      installments = rows
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
      if (code === 'QUOTE_NOT_FOUND') {
        setServerError('Orçamento não encontrado.')
      } else if (code === 'ALREADY_ACCEPTED') {
        setServerError('Este orçamento já foi aceito.')
      } else if (code === 'NO_ACTIVE_VERSION') {
        setServerError('O orçamento não possui uma versão ativa.')
      } else {
        setServerError('Erro ao aceitar orçamento. Tente novamente.')
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
    width: '100%',
  }

  const isPending = acceptMutation.isPending

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, isPending])

  return (
    // Backdrop
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
              style={inputStyle}
            />
          </label>

          {/* Installments (only when INSTALLMENTS selected) */}
          {paymentType === 'INSTALLMENTS' && (
            <div>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-neutral-600)',
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Parcelas
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {installmentRows.map((row, index) => (
                  <div key={row._key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => updateRow(index, { dueDate: e.target.value })}
                      required
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Valor (R$)"
                      value={row.amountStr}
                      onChange={(e) => updateRow(index, { amountStr: e.target.value })}
                      required
                      style={{ ...inputStyle, width: 130, flexShrink: 0 }}
                    />
                    {installmentRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        style={{
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addRow}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: '1px dashed var(--color-neutral-300)',
                  padding: '6px var(--space-2)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--color-primary)',
                  fontSize: '0.875rem',
                  width: '100%',
                }}
              >
                + Adicionar parcela
              </button>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginTop: 4 }}>
                Total das parcelas: {formatCurrency(installmentTotal)}
              </p>
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
