import { useState } from 'react'
import { Link, useParams, useNavigate } from '@tanstack/react-router'
import { useQuote, useUpdateStatus, useDuplicateQuote } from './hooks'
import { generateQuotePDF } from './QuotePDF'
import { STATUS_LABEL, STATUS_COLOR } from './statusLabels'
import { formatCurrency } from '@/lib/format'
import { useAuthStore } from '@/stores/authStore'
import type { QuoteVersion } from './types'
import { AcceptQuoteModal } from './AcceptQuoteModal'

export function QuoteDetailPage() {
  const params = useParams({ strict: false }) as { id: string }
  const { data: quote, isLoading, error } = useQuote(params.id)
  const { user } = useAuthStore()
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const updateStatusMutation = useUpdateStatus()
  const navigate = useNavigate()
  const duplicateMutation = useDuplicateQuote()

  function handleDownloadPDF() {
    if (quote?.activeVersion) generateQuotePDF(quote)
  }

  async function handleDuplicate() {
    const result = await duplicateMutation.mutateAsync(quote!.id)
    void navigate({ to: '/quotes/$id', params: { id: result.id } })
  }

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error || !quote) return <p style={{ color: 'var(--color-danger)' }}>Orçamento não encontrado.</p>

  const colors = STATUS_COLOR[quote.status] ?? { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' }
  const canAddVersion =
    quote.status !== 'ACCEPTED' &&
    (user?.role === 'ADMIN' || user?.role === 'SALES')
  const isAdmin = user?.role === 'ADMIN'
  const canChangeStatus = isAdmin && quote.status !== 'ACCEPTED' && quote.status !== 'DRAFT'
  const canAccept = isAdmin && quote.status !== 'ACCEPTED' && quote.status !== 'DRAFT' && quote.activeVersion !== null

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <Link to="/quotes" style={{ color: 'var(--color-primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
            ← Orçamentos
          </Link>
          <h1 style={{ fontSize: '1.5rem', marginTop: 4 }}>{quote.client.name}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', marginTop: 2 }}>
            Criado em {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span
            style={{
              background: colors.bg,
              color: colors.text,
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {STATUS_LABEL[quote.status] ?? quote.status}
          </span>
          {canChangeStatus && (
            <>
              {quote.status !== 'PENDING_REVIEW' && (
                <button
                  disabled={updateStatusMutation.isPending}
                  onClick={() =>
                    updateStatusMutation.mutate({
                      id: quote.id,
                      payload: { status: 'PENDING_REVIEW' },
                    })
                  }
                  style={{
                    background: 'var(--color-warning-bg)',
                    color: 'var(--color-warning)',
                    border: 'none',
                    padding: '6px var(--space-2)',
                    borderRadius: 4,
                    cursor: updateStatusMutation.isPending ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  Em Análise
                </button>
              )}
              {quote.status !== 'REJECTED' && (
                <button
                  disabled={updateStatusMutation.isPending}
                  onClick={() => {
                    if (confirm('Rejeitar este orçamento?')) {
                      updateStatusMutation.mutate({
                        id: quote.id,
                        payload: { status: 'REJECTED' },
                      })
                    }
                  }}
                  style={{
                    background: 'var(--color-danger-bg)',
                    color: 'var(--color-danger)',
                    border: 'none',
                    padding: '6px var(--space-2)',
                    borderRadius: 4,
                    cursor: updateStatusMutation.isPending ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  Rejeitar
                </button>
              )}
              {quote.status !== 'NO_RESPONSE' && (
                <button
                  disabled={updateStatusMutation.isPending}
                  onClick={() =>
                    updateStatusMutation.mutate({
                      id: quote.id,
                      payload: { status: 'NO_RESPONSE' },
                    })
                  }
                  style={{
                    background: 'var(--color-neutral-100)',
                    color: 'var(--color-neutral-600)',
                    border: '1px solid var(--color-neutral-300)',
                    padding: '6px var(--space-2)',
                    borderRadius: 4,
                    cursor: updateStatusMutation.isPending ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  Sem Retorno
                </button>
              )}
            </>
          )}
          {canAccept && (
            <button
              onClick={() => setShowAcceptModal(true)}
              disabled={updateStatusMutation.isPending}
              style={{
                background: 'var(--color-success)',
                color: 'var(--color-surface)',
                border: 'none',
                padding: '6px var(--space-2)',
                borderRadius: 4,
                cursor: updateStatusMutation.isPending ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: updateStatusMutation.isPending ? 0.7 : 1,
              }}
            >
              Aceitar
            </button>
          )}
          {canAddVersion && (
            <Link
              to="/quotes/$id/versions/new"
              params={{ id: quote.id }}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-surface)',
                textDecoration: 'none',
                padding: '6px var(--space-2)',
                borderRadius: 4,
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              + Nova Versão
            </Link>
          )}
          {quote.activeVersion && (
            <button
              onClick={handleDownloadPDF}
              style={{
                background: 'var(--color-neutral-100)',
                color: 'var(--color-neutral-900)',
                border: '1px solid var(--color-neutral-300)',
                padding: '6px var(--space-2)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Baixar PDF
            </button>
          )}
          {(user?.role === 'ADMIN' || user?.role === 'SALES') && (
            <button
              onClick={() => void handleDuplicate()}
              disabled={duplicateMutation.isPending}
              style={{
                background: 'var(--color-neutral-100)',
                color: 'var(--color-neutral-900)',
                border: '1px solid var(--color-neutral-300)',
                padding: '6px var(--space-2)',
                borderRadius: 4,
                cursor: duplicateMutation.isPending ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: duplicateMutation.isPending ? 0.6 : 1,
              }}
            >
              {duplicateMutation.isPending ? 'Duplicando...' : 'Duplicar'}
            </button>
          )}
        </div>
      </div>

      {/* Active version */}
      {quote.activeVersion && (
        <VersionCard version={quote.activeVersion} isActive />
      )}

      {/* Version history (all non-active versions) */}
      {quote.versions.length > 1 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Histórico de versões
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {quote.versions
              .filter((v) => v.id !== quote.activeVersion?.id)
              .map((v) => (
                <VersionCard key={v.id} version={v} isActive={false} />
              ))}
          </div>
        </div>
      )}

      {/* Sale info */}
      {quote.sale && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            borderRadius: 8,
            padding: 'var(--space-2) var(--space-3)',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-success)' }}>
            Venda Registrada
          </h2>
          <p style={{ fontSize: '0.875rem' }}>
            Tipo:{' '}
            <strong>{quote.sale.paymentType === 'LUMP_SUM' ? 'À vista' : 'Parcelado'}</strong>
            {quote.sale.downPayment > 0 && (
              <> · Entrada: <strong>{formatCurrency(quote.sale.downPayment)}</strong></>
            )}
            {' '}· Total: <strong>{formatCurrency(quote.sale.total)}</strong>
          </p>
          {quote.sale.installments.length > 0 && (
            <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Vencimento</th>
                  <th style={{ textAlign: 'right', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Valor</th>
                  <th style={{ textAlign: 'right', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {quote.sale.installments.map((inst) => (
                  <tr key={inst.id}>
                    <td style={{ paddingTop: 4 }}>{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td style={{ paddingTop: 4, textAlign: 'right' }}>{formatCurrency(inst.amount)}</td>
                    <td
                      style={{
                        paddingTop: 4,
                        textAlign: 'right',
                        color: inst.status === 'PAID' ? 'var(--color-success)' : inst.status === 'OVERDUE' ? 'var(--color-danger)' : 'var(--color-neutral-600)',
                      }}
                    >
                      {inst.status === 'PAID' ? 'Pago' : inst.status === 'OVERDUE' ? 'Vencido' : 'Pendente'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {showAcceptModal && (
        <AcceptQuoteModal
          quoteId={quote.id}
          total={quote.activeVersion!.total}
          onClose={() => setShowAcceptModal(false)}
        />
      )}
    </div>
  )
}

function VersionCard({ version, isActive }: { version: QuoteVersion; isActive: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-neutral-300)'}`,
        borderRadius: 8,
        padding: 'var(--space-2) var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>
          Versão {version.version}
          {isActive && (
            <span
              style={{
                marginLeft: 8,
                fontSize: '0.75rem',
                color: 'var(--color-primary)',
                background: 'var(--color-primary-bg)',
                padding: '2px 6px',
                borderRadius: 10,
              }}
            >
              ativa
            </span>
          )}
        </span>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
          {new Date(version.createdAt).toLocaleDateString('pt-BR')}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: 'var(--color-neutral-100)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Item</th>
            <th style={{ textAlign: 'center', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Qtd</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Unit.</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {version.items.map((item) => (
            <tr key={item.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
              <td style={{ padding: '4px 8px' }}>
                {item.product
                  ? `${item.product.name}${item.product.unit ? ` (${item.product.unit})` : ''}`
                  : item.kit?.name ?? '—'}
                {item.kit && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-600)', marginLeft: 4 }}>
                    [kit]
                  </span>
                )}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>
                {formatCurrency(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-3)',
          marginTop: 8,
          fontSize: '0.875rem',
        }}
      >
        <span style={{ color: 'var(--color-neutral-600)' }}>Subtotal: {formatCurrency(version.subtotal)}</span>
        {version.laborCost > 0 && (
          <span style={{ color: 'var(--color-neutral-600)' }}>M.O.: +{formatCurrency(version.laborCost)}</span>
        )}
        {version.discount > 0 && (
          <span style={{ color: 'var(--color-neutral-600)' }}>Desconto: -{formatCurrency(version.discount)}</span>
        )}
        <strong>Total: {formatCurrency(version.total)}</strong>
      </div>
    </div>
  )
}
