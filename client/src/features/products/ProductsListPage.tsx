import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useProducts, useDeleteProduct } from './hooks'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/format'

export function ProductsListPage() {
  const { data: products, isLoading, error } = useProducts()
  const deleteMutation = useDeleteProduct()
  const { user } = useAuthStore()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar produtos.</p>

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
        <h1 style={{ fontSize: '1.5rem' }}>Produtos</h1>
        {user?.role === 'ADMIN' && (
          <Link to="/products/new">
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
              + Novo Produto
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
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Nome</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Un.</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Custo</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Markup</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Preço Final</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Estoque</th>
              {user?.role === 'ADMIN' && (
                <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Ações</th>
              )}
            </tr>
          </thead>
          <tbody>
            {products?.length === 0 && (
              <tr>
                <td colSpan={user?.role === 'ADMIN' ? 7 : 6} style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-neutral-600)' }}>
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
            {products?.map((product, i) => (
              <tr key={product.id} style={{ borderTop: '1px solid var(--color-neutral-300)', background: i % 2 === 1 ? 'var(--color-neutral-100)' : 'transparent' }}>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>{product.name}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: 'var(--color-neutral-600)' }}>{product.unit ?? '—'}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(product.basePrice)}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right' }}>{product.markupPercent}%</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(product.finalPrice)}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'right' }}>{product.stockQty}</td>
                {user?.role === 'ADMIN' && (
                  <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to="/products/$id/edit" params={{ id: product.id }}>
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
                      <button
                        disabled={deletingId === product.id}
                        onClick={() => {
                          if (confirm(`Excluir "${product.name}"?`)) {
                            setDeletingId(product.id)
                            deleteMutation.mutate(product.id, {
                              onSettled: () => setDeletingId(null),
                            })
                          }
                        }}
                        style={{
                          background: 'var(--color-danger-bg)',
                          color: 'var(--color-danger)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: deletingId === product.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          opacity: deletingId === product.id ? 0.6 : 1,
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
