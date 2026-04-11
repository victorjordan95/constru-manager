import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useProduct, useCreateProduct, useUpdateProduct } from './hooks'
import type { CreateProductPayload } from './types'
import { formatCurrency } from '@/lib/format'

type FormState = {
  name: string
  basePriceBrl: string   // user input in BRL, e.g. "125.50"
  markupPercent: string  // user input, e.g. "20"
  unit: string
  minStock: string
}

const empty: FormState = {
  name: '',
  basePriceBrl: '',
  markupPercent: '0',
  unit: '',
  minStock: '0',
}

export function ProductFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id
  const isEdit = Boolean(id)

  const { data: existing } = useProduct(id ?? '', { enabled: isEdit })
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()

  const [form, setForm] = useState<FormState>(empty)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        basePriceBrl: (existing.basePrice / 100).toFixed(2),
        markupPercent: String(existing.markupPercent),
        unit: existing.unit ?? '',
        minStock: String(existing.minStock),
      })
    } else if (!isEdit) {
      setForm(empty)
      setServerError(null)
    }
  }, [existing, isEdit])

  // Preview finalPrice client-side: round(base * 100 * (1 + markup/100))
  const basePriceRaw = parseFloat(form.basePriceBrl)
  const markupNum = parseFloat(form.markupPercent)
  const previewFinalPrice =
    isNaN(basePriceRaw) || isNaN(markupNum)
      ? 0
      : Math.round(basePriceRaw * 100 * (1 + markupNum / 100))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const basePrice = Math.round(parseFloat(form.basePriceBrl) * 100)
    const markupPercent = parseFloat(form.markupPercent)

    if (isNaN(basePrice) || basePrice < 0) {
      setServerError('Custo inválido.')
      return
    }
    if (isNaN(markupPercent) || markupPercent < 0) {
      setServerError('Markup inválido.')
      return
    }

    const payload: CreateProductPayload = {
      name: form.name,
      basePrice,
      markupPercent,
      ...(form.unit && { unit: form.unit }),
      ...(form.minStock !== '' && { minStock: parseInt(form.minStock, 10) }),
    }

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      void navigate({ to: '/products' })
    } catch {
      setServerError('Erro ao salvar produto. Tente novamente.')
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
  const labelTextStyle: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Produto' : 'Novo Produto'}
      </h1>
      {serverError && (
        <p style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: 'var(--space-1)', borderRadius: 4, marginBottom: 'var(--space-2)' }}>
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
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Custo (R$) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            style={inputStyle}
            value={form.basePriceBrl}
            onChange={(e) => setForm({ ...form, basePriceBrl: e.target.value })}
            required
            placeholder="0.00"
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Markup (%) *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            style={inputStyle}
            value={form.markupPercent}
            onChange={(e) => setForm({ ...form, markupPercent: e.target.value })}
            required
          />
        </label>
        <div
          style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            padding: 'var(--space-1)',
            borderRadius: 4,
          }}
        >
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Preço final estimado: </span>
          <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(previewFinalPrice)}</strong>
        </div>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Unidade (ex: m², kg, un)</span>
          <input style={inputStyle} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="un" />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Estoque mínimo</span>
          <input type="number" min="0" style={inputStyle} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
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
            onClick={() => void navigate({ to: '/products' })}
            style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
