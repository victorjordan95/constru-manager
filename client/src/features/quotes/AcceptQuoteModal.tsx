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
