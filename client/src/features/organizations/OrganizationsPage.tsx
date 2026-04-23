import { useState } from 'react'
import { useOrganizations, useCreateOrganization, useCreateAdmin } from './hooks'

export function OrganizationsPage() {
  const { data: orgs, isLoading } = useOrganizations()
  const createOrgMutation = useCreateOrganization()
  const createAdminMutation = useCreateAdmin()

  const [newOrgName, setNewOrgName] = useState('')
  const [orgError, setOrgError] = useState<string | null>(null)

  const [adminModal, setAdminModal] = useState<{ orgId: string; orgName: string } | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    setOrgError(null)
    try {
      await createOrgMutation.mutateAsync(newOrgName)
      setNewOrgName('')
    } catch {
      setOrgError('Erro ao criar organização.')
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!adminModal) return
    setAdminError(null)
    try {
      await createAdminMutation.mutateAsync({ orgId: adminModal.orgId, email: adminEmail, password: adminPassword })
      setAdminModal(null)
      setAdminEmail('')
      setAdminPassword('')
    } catch {
      setAdminError('Erro ao criar admin. Verifique se o e-mail já está em uso.')
    }
  }

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>Organizações</h1>

      <form onSubmit={handleCreateOrg} style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Nome da organização"
          value={newOrgName}
          onChange={e => setNewOrgName(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={createOrgMutation.isPending}
          style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          + Nova Org
        </button>
      </form>
      {orgError && <p style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>{orgError}</p>}

      <div style={{ background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-neutral-300)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-bg)' }}>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Nome</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Status</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Criada em</th>
              <th style={{ padding: 'var(--space-1) var(--space-2)', textAlign: 'left', fontSize: '0.875rem', color: 'var(--color-primary)' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {orgs?.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-neutral-600)' }}>Nenhuma organização.</td></tr>
            )}
            {orgs?.map((org, i) => (
              <tr key={org.id} style={{ borderTop: '1px solid var(--color-neutral-300)', background: i % 2 === 1 ? 'var(--color-neutral-100)' : 'transparent' }}>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>{org.name}</td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: org.isActive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {org.isActive ? 'Ativa' : 'Inativa'}
                </td>
                <td style={{ padding: 'var(--space-1) var(--space-2)', color: 'var(--color-neutral-600)', fontSize: '0.875rem' }}>
                  {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td style={{ padding: 'var(--space-1) var(--space-2)' }}>
                  <button
                    onClick={() => setAdminModal({ orgId: org.id, orgName: org.name })}
                    style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Criar Admin
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adminModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleCreateAdmin}
            style={{ background: 'var(--color-surface)', padding: 'var(--space-4)', borderRadius: 8, width: 380, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
          >
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Criar Admin — {adminModal.orgName}</h2>
            {adminError && <p style={{ color: 'var(--color-danger)', margin: 0, fontSize: '0.875rem' }}>{adminError}</p>}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>E-mail</span>
              <input type="email" style={inputStyle} value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Senha (mín. 8 caracteres)</span>
              <input type="password" style={inputStyle} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required minLength={8} />
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAdminModal(null)} style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={createAdminMutation.isPending} style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                {createAdminMutation.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
