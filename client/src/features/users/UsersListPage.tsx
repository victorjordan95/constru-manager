import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useUsers, useDeactivateUser } from './hooks'
import { useAuthStore } from '@/stores/authStore'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  SALES: 'Vendas',
  FINANCE: 'Financeiro',
}

export function UsersListPage() {
  const { data: users, isLoading, error } = useUsers()
  const deactivateMutation = useDeactivateUser()
  const { user: me } = useAuthStore()
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar usuários.</p>

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
        <h1 style={{ fontSize: '1.5rem' }}>Usuários</h1>
        <Link to="/users/new">
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
            + Novo Usuário
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
              {(['Email', 'Papel', 'Status', 'Cadastrado em', 'Ações'] as const).map((h) => (
                <th
                  key={h}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    color: 'var(--color-primary)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users?.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: 'var(--space-3)',
                    textAlign: 'center',
                    color: 'var(--color-neutral-600)',
                  }}
                >
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
            {users?.map((u) => {
              const isMe = u.id === me?.userId
              const canDeactivate = u.isActive && !isMe
              const isDeactivating = deactivatingId === u.id

              return (
                <tr key={u.id} style={{ borderTop: '1px solid var(--color-neutral-300)' }}>
                  <td style={{ padding: 'var(--space-1) var(--space-2)' }}>{u.email}</td>
                  <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </td>
                  <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: u.isActive ? 'var(--color-success-bg, #dcfce7)' : 'var(--color-neutral-200)',
                        color: u.isActive ? 'var(--color-success, #16a34a)' : 'var(--color-neutral-500)',
                      }}
                    >
                      {u.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-1) var(--space-2)', color: 'var(--color-neutral-600)', fontSize: '0.875rem' }}>
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                    <button
                      disabled={!canDeactivate || isDeactivating}
                      onClick={() => {
                        if (!confirm(`Desativar "${u.email}"?`)) return
                        setDeactivatingId(u.id)
                        deactivateMutation.mutate(u.id, {
                          onSettled: () => setDeactivatingId(null),
                        })
                      }}
                      style={{
                        background: canDeactivate ? 'var(--color-danger-bg)' : 'var(--color-neutral-100)',
                        color: canDeactivate ? 'var(--color-danger)' : 'var(--color-neutral-400)',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: 4,
                        cursor: canDeactivate && !isDeactivating ? 'pointer' : 'not-allowed',
                        fontSize: '0.875rem',
                        opacity: isDeactivating ? 0.6 : 1,
                      }}
                    >
                      {isDeactivating ? 'Desativando...' : 'Desativar'}
                    </button>
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
