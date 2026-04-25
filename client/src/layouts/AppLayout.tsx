import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { queryClient } from '@/lib/queryClient'
import { logout as apiLogout } from '@/features/auth/api'
import { useCurrentOrganization } from '@/features/organizations/hooks'

export function AppLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const { data: currentOrg } = useCurrentOrganization()

  async function handleLogout() {
    try {
      await apiLogout()
    } catch {
      // ignore — still clear local auth
    }
    queryClient.clear()
    clearAuth()
    void navigate({ to: '/login' })
  }

  const linkStyle: React.CSSProperties = {
    color: 'inherit',
    textDecoration: 'none',
    display: 'block',
    padding: '6px 8px',
    borderRadius: 4,
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-family)' }}>
      <nav
        style={{
          width: 'var(--sidebar-width)',
          flexShrink: 0,
          background: 'var(--color-primary)',
          color: 'var(--color-surface)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ marginBottom: 'var(--space-3)' }}>
          {currentOrg?.logoUrl ? (
            <img
              src={currentOrg.logoUrl}
              alt={currentOrg.name}
              style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <p style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Constru Manager</p>
          )}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {user?.role === 'SUPER_ADMIN' ? (
            <>
              <li><Link to="/organizations" style={linkStyle}>Organizações</Link></li>
              <li><Link to="/users" style={linkStyle}>Usuários</Link></li>
            </>
          ) : (
            <>
              {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
                <li><Link to="/clients" style={linkStyle}>Clientes</Link></li>
              )}
              {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
                <li><Link to="/products" style={linkStyle}>Produtos</Link></li>
              )}
              {user?.role === 'ADMIN' && (
                <li><Link to="/kits" style={linkStyle}>Kits</Link></li>
              )}
              {user?.role === 'ADMIN' && (
                <li><Link to="/users" style={linkStyle}>Usuários</Link></li>
              )}
              {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
                <li><Link to="/quotes" style={linkStyle}>Orçamentos</Link></li>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'FINANCE') && (
                <li><Link to="/finance" style={linkStyle}>Financeiro</Link></li>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'FINANCE') && (
                <li><Link to="/dre" style={linkStyle}>DRE</Link></li>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'FINANCE') && (
                <li><Link to="/fixed-expenses" style={linkStyle}>Despesas Fixas</Link></li>
              )}
              {user?.role === 'ADMIN' && (
                <li><Link to="/settings" style={linkStyle}>Configurações</Link></li>
              )}
            </>
          )}
        </ul>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 'var(--space-2)' }}>
          <p style={{ fontSize: '0.75rem', marginBottom: 4, opacity: 0.7 }}>{user?.role}</p>
          <button
            onClick={() => void handleLogout()}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.5)',
              color: 'var(--color-surface)',
              padding: '6px var(--space-1)',
              borderRadius: 4,
              cursor: 'pointer',
              width: '100%',
              fontSize: '0.875rem',
            }}
          >
            Sair
          </button>
        </div>
      </nav>
      <main
        style={{
          flex: 1,
          padding: 'var(--space-4)',
          overflow: 'auto',
          background: 'var(--color-neutral-100)',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
