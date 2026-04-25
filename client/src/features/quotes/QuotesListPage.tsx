import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuotes, useUpdateStatus, useDuplicateQuote } from './hooks'
import { STATUS_LABEL, STATUS_COLOR } from './statusLabels'
import { formatCurrency } from '@/lib/format'
import { useAuthStore } from '@/stores/authStore'
import { AcceptQuoteModal } from './AcceptQuoteModal'
import type { QuoteStatus, StockWarning } from './types'

export function QuotesListPage() {
  const { data: quotes, isLoading, error } = useQuotes()
  const { user } = useAuthStore()
  const updateStatusMutation = useUpdateStatus()
  const [acceptModal, setAcceptModal] = useState<{ quoteId: string; total: number } | null>(null)
  const [stockWarnings, setStockWarnings] = useState<StockWarning[]>([])

  const isAdmin = user?.role === 'ADMIN'
  const navigate = useNavigate()
  const duplicateMutation = useDuplicateQuote()

  async function handleDuplicate(id: string) {
    const result = await duplicateMutation.mutateAsync(id)
    void navigate({ to: '/quotes/$id', params: { id: result.id } })
  }

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
            {quotes?.map((q, i) => {
              const colors = STATUS_COLOR[q.status] ?? { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' }
              const showActions = canShowActions(q.status)
              const isMutating = updateStatusMutation.isPending

              return (
                <tr key={q.id} style={{ borderTop: '1px solid var(--color-neutral-300)', background: i % 2 === 1 ? 'var(--color-neutral-100)' : 'transparent' }}>
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
                      {(user?.role === 'ADMIN' || user?.role === 'SALES') && (
                        <button
                          onClick={() => void handleDuplicate(q.id)}
                          disabled={duplicateMutation.isPending}
                          style={{ ...btnSecondary, opacity: duplicateMutation.isPending ? 0.6 : 1 }}
                        >
                          Duplicar
                        </button>
                      )}
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

      {stockWarnings.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning)',
            borderRadius: 8,
            padding: 'var(--space-2)',
            minWidth: 340,
            maxWidth: 560,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: 'var(--space-1)' }}>
                Atenção: reposição de estoque necessária
              </p>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '2px 8px', color: 'var(--color-neutral-600)' }}>Produto</th>
                    <th style={{ textAlign: 'right', padding: '2px 8px', color: 'var(--color-neutral-600)' }}>Estoque atual</th>
                    <th style={{ textAlign: 'right', padding: '2px 8px', color: 'var(--color-neutral-600)' }}>Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {stockWarnings.map((w) => (
                    <tr key={w.productId} style={{ borderTop: '1px solid var(--color-warning)' }}>
                      <td style={{ padding: '2px 8px' }}>{w.productName}</td>
                      <td style={{ padding: '2px 8px', textAlign: 'right', fontWeight: 700, color: w.stockQty < 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                        {w.stockQty}
                      </td>
                      <td style={{ padding: '2px 8px', textAlign: 'right', color: 'var(--color-neutral-600)' }}>
                        {w.minStock ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setStockWarnings([])}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-warning)',
                fontWeight: 700,
                fontSize: '1rem',
                marginLeft: 'var(--space-2)',
                flexShrink: 0,
              }}
              aria-label="Fechar aviso"
            >
              OK, entendi
            </button>
          </div>
        </div>
      )}

      {acceptModal && (
        <AcceptQuoteModal
          quoteId={acceptModal.quoteId}
          total={acceptModal.total}
          onClose={() => setAcceptModal(null)}
          onAccepted={(warnings) => {
            setAcceptModal(null)
            setStockWarnings(warnings)
          }}
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
