import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useClients, useDeleteClient } from './hooks'
import { useAuthStore } from '@/stores/authStore'

export function ClientsListPage() {
  const { data: clients, isLoading, error } = useClients()
  const deleteMutation = useDeleteClient()
  const { user } = useAuthStore()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar clientes.</p>

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
        <h1 style={{ fontSize: '1.5rem' }}>Clientes</h1>
        <Link to="/clients/new">
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
            + Novo Cliente
          </button>
        </Link>
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
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>CPF/CNPJ</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Email</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Telefone</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients?.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-neutral-600)' }}>
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )}
            {clients?.map((client) => (
              <tr
                key={client.id}
                style={{ borderTop: '1px solid var(--color-neutral-300)' }}
              >
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>{client.name}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', fontFamily: 'monospace' }}>{client.taxId}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: client.email ? 'inherit' : 'var(--color-neutral-600)' }}>{client.email ?? '—'}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: client.phone ? 'inherit' : 'var(--color-neutral-600)' }}>{client.phone ?? '—'}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to="/clients/$id/edit" params={{ id: client.id }}>
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
                    {user?.role === 'ADMIN' && (
                      <button
                        disabled={deletingId === client.id}
                        onClick={() => {
                          if (confirm(`Excluir "${client.name}"?`)) {
                            setDeletingId(client.id)
                            deleteMutation.mutate(client.id, {
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
                          cursor: deletingId === client.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          opacity: deletingId === client.id ? 0.6 : 1,
                        }}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
