import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { decodeToken } from '@/lib/jwt'
import { login } from './api'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { accessToken } = await login(email, password)
      setAuth(accessToken, decodeToken(accessToken))
      void navigate({ to: '/' })
    } catch {
      setError('Email ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    marginTop: 4,
    boxSizing: 'border-box',
    fontSize: '1rem',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-neutral-100)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 8,
          width: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            color: 'var(--color-primary)',
            margin: 0,
            fontFamily: 'var(--font-family)',
          }}
        >
          Constru Manager
        </h1>
        {error && (
          <p
            style={{
              color: 'var(--color-danger)',
              background: 'var(--color-danger-bg)',
              padding: 'var(--space-1)',
              borderRadius: 4,
              margin: 0,
              fontSize: '0.875rem',
            }}
          >
            {error}
          </p>
        )}
        <label>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={inputStyle}
          />
        </label>
        <label>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
