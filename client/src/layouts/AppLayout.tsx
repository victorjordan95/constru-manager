import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { logout as apiLogout } from '@/features/auth/api'

export function AppLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await apiLogout()
    } catch {
      // ignore — still clear local auth
    }
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
        <p
          style={{
            fontWeight: 700,
            marginBottom: 'var(--space-3)',
            fontSize: '1rem',
          }}
        >
          Constru Manager
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
            <li>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link to={'/clients' as any} style={linkStyle}>
                Clientes
              </Link>
            </li>
          )}
          {(user?.role === 'SALES' || user?.role === 'ADMIN') && (
            <li>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link to={'/products' as any} style={linkStyle}>
                Produtos
              </Link>
            </li>
          )}
          {user?.role === 'ADMIN' && (
            <li>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link to={'/kits' as any} style={linkStyle}>
                Kits
              </Link>
            </li>
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
