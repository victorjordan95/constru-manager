import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useRegisterUser } from './hooks'
import type { RegisterUserPayload } from './api'

type FormState = {
  email: string
  password: string
  role: 'ADMIN' | 'SALES' | 'FINANCE'
}

const empty: FormState = { email: '', password: '', role: 'SALES' }

export function UserFormPage() {
  const navigate = useNavigate()
  const registerMutation = useRegisterUser()
  const [form, setForm] = useState<FormState>(empty)
  const [serverError, setServerError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    setPasswordError(null)

    if (form.password.length < 8) {
      setPasswordError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    const payload: RegisterUserPayload = {
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    }

    try {
      await registerMutation.mutateAsync(payload)
      void navigate({ to: '/users' })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'EMAIL_TAKEN') {
        setServerError('Email já está em uso.')
      } else {
        setServerError('Erro ao cadastrar usuário. Tente novamente.')
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    marginTop: 4,
    fontSize: '1rem',
  }

  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 }
  const labelTextStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--color-neutral-600)',
    fontWeight: 500,
  }

  const isPending = registerMutation.isPending

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>Novo Usuário</h1>
      {serverError && (
        <p
          style={{
            color: 'var(--color-danger)',
            background: 'var(--color-danger-bg)',
            padding: 'var(--space-1)',
            borderRadius: 4,
            marginBottom: 'var(--space-2)',
          }}
        >
          {serverError}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <label style={labelStyle} htmlFor="u-email">
          <span style={labelTextStyle}>Email *</span>
          <input
            id="u-email"
            type="email"
            style={inputStyle}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label style={labelStyle} htmlFor="u-password">
          <span style={labelTextStyle}>Senha *</span>
          <input
            id="u-password"
            type="password"
            style={{
              ...inputStyle,
              borderColor: passwordError ? 'var(--color-danger)' : 'var(--color-neutral-300)',
            }}
            value={form.password}
            onChange={(e) => {
              setPasswordError(null)
              setForm({ ...form, password: e.target.value })
            }}
            required
          />
          {passwordError && (
            <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)', marginTop: 2 }}>
              {passwordError}
            </span>
          )}
        </label>
        <label style={labelStyle} htmlFor="u-role">
          <span style={labelTextStyle}>Papel *</span>
          <select
            id="u-role"
            style={inputStyle}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as FormState['role'] })}
          >
            <option value="ADMIN">Admin</option>
            <option value="SALES">Vendas</option>
            <option value="FINANCE">Financeiro</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Salvando...' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/users' })}
            style={{
              background: 'none',
              border: '1px solid var(--color-neutral-300)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
