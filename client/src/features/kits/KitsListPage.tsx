import { Link } from '@tanstack/react-router'
import { useKits } from './hooks'
import { formatCurrency } from '@/lib/format'

export function KitsListPage() {
  const { data: kits, isLoading, error } = useKits()

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar kits.</p>

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
        <h1 style={{ fontSize: '1.5rem' }}>Kits</h1>
        <Link to="/kits/new">
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
            + Novo Kit
          </button>
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {kits?.length === 0 && (
          <p style={{ color: 'var(--color-neutral-600)' }}>Nenhum kit cadastrado.</p>
        )}
        {kits?.map((kit) => (
          <div
            key={kit.id}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-neutral-300)',
              borderRadius: 8,
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{kit.name}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
                  {kit.items.length} {kit.items.length === 1 ? 'item' : 'itens'} ·{' '}
                  <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(kit.totalPrice)}</strong>
                </p>
              </div>
              <Link to="/kits/$id/edit" params={{ id: kit.id }}>
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
                  Editar
                </button>
              </Link>
            </div>
            <ul style={{ margin: '8px 0 0', padding: '0 0 0 var(--space-2)', fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
              {kit.items.map((item) => (
                <li key={item.id}>
                  {item.product.name} × {item.quantity}
                  {item.product.unit ? ` ${item.product.unit}` : ''} —{' '}
                  {formatCurrency(item.product.finalPrice * item.quantity)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
