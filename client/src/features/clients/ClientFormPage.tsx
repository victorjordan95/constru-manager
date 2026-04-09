import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useClient, useCreateClient, useUpdateClient } from './hooks'
import type { CreateClientPayload } from './types'

type FormState = {
  name: string
  taxId: string
  nationalId: string
  address: string
  zipCode: string
  email: string
  phone: string
}

const empty: FormState = {
  name: '',
  taxId: '',
  nationalId: '',
  address: '',
  zipCode: '',
  email: '',
  phone: '',
}

export function ClientFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id
  const isEdit = Boolean(id)

  const { data: existing } = useClient(id ?? '', { enabled: isEdit })
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()

  const [form, setForm] = useState<FormState>(empty)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        taxId: existing.taxId,
        nationalId: existing.nationalId ?? '',
        address: existing.address ?? '',
        zipCode: existing.zipCode ?? '',
        email: existing.email ?? '',
        phone: existing.phone ?? '',
      })
    }
  }, [existing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    // Strip empty optional strings to undefined
    const payload: CreateClientPayload = {
      name: form.name,
      taxId: form.taxId,
      ...(form.nationalId && { nationalId: form.nationalId }),
      ...(form.address && { address: form.address }),
      ...(form.zipCode && { zipCode: form.zipCode }),
      ...(form.email && { email: form.email }),
      ...(form.phone && { phone: form.phone }),
    }

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      void navigate({ to: '/clients' })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'DUPLICATE_TAX_ID') {
        setServerError('CPF/CNPJ já está cadastrado.')
      } else {
        setServerError('Erro ao salvar cliente. Tente novamente.')
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

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }

  const labelTextStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--color-neutral-600)',
    fontWeight: 500,
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
      </h1>
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
        <label style={labelStyle}>
          <span style={labelTextStyle}>Nome *</span>
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>CPF / CNPJ *</span>
          <input
            style={inputStyle}
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            required
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>RG / Identidade</span>
          <input
            style={inputStyle}
            value={form.nationalId}
            onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Endereço</span>
          <input
            style={inputStyle}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>CEP</span>
          <input
            style={inputStyle}
            value={form.zipCode}
            onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Email</span>
          <input
            type="email"
            style={inputStyle}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Telefone</span>
          <input
            style={inputStyle}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
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
            {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/clients' })}
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
