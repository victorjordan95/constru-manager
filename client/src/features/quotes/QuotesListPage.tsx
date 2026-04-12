import { Link } from '@tanstack/react-router'
import { useQuotes } from './hooks'
import { STATUS_LABEL, STATUS_COLOR } from './statusLabels'
import { formatCurrency } from '@/lib/format'
import { useAuthStore } from '@/stores/authStore'

export function QuotesListPage() {
  const { data: quotes, isLoading, error } = useQuotes()
  const { user } = useAuthStore()

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar orçamentos.</p>

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
              const colors = STATUS_COLOR[q.status]
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
                      {STATUS_LABEL[q.status]}
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
                    <Link to="/quotes/$id" params={{ id: q.id }}>
                      <button
                        style={{
                          background: 'var(--color-primary-bg)',
                          color: 'var(--color-primary)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Ver
                      </button>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
