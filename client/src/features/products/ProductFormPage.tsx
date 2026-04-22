import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useProduct, useCreateProduct, useUpdateProduct } from './hooks'
import type { CreateProductPayload } from './types'
import { formatCurrency } from '@/lib/format'
import { maskCurrency, parseCurrencyInput, centsToMasked, maskDecimal, parseDecimalInput } from '@/lib/currencyInput'

type FormState = {
  name: string
  basePriceBrl: string
  markupPercent: string
  unit: string
  stockQty: string
  minStock: string
}

const empty: FormState = {
  name: '',
  basePriceBrl: '',
  markupPercent: '0',
  unit: '',
  stockQty: '0',
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
        basePriceBrl: centsToMasked(existing.basePrice),
        markupPercent: maskDecimal(String(existing.markupPercent)),
        unit: existing.unit ?? '',
        stockQty: String(existing.stockQty),
        minStock: String(existing.minStock),
      })
    } else if (!isEdit) {
      setForm(empty)
      setServerError(null)
    }
  }, [existing, isEdit])

  const basePriceCents = parseCurrencyInput(form.basePriceBrl)
  const markupNum = parseDecimalInput(form.markupPercent)
  const previewFinalPrice = Math.round(basePriceCents * (1 + markupNum / 100))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const basePrice = parseCurrencyInput(form.basePriceBrl)
    const markupPercent = parseDecimalInput(form.markupPercent)

    if (basePrice < 0) {
      setServerError('Custo inválido.')
      return
    }
    if (markupPercent < 0) {
      setServerError('Markup inválido.')
      return
    }

    const payload: CreateProductPayload = {
      name: form.name,
      basePrice,
      markupPercent,
      ...(form.unit && { unit: form.unit }),
      ...(form.stockQty !== '' && { stockQty: parseInt(form.stockQty, 10) }),
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
            inputMode="numeric"
            style={inputStyle}
            value={form.basePriceBrl}
            onChange={(e) => setForm({ ...form, basePriceBrl: maskCurrency(e.target.value) })}
            required
            placeholder="0,00"
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Markup (%) *</span>
          <input
            inputMode="decimal"
            style={inputStyle}
            value={form.markupPercent}
            onChange={(e) => setForm({ ...form, markupPercent: maskDecimal(e.target.value) })}
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
          <span style={labelTextStyle}>Estoque inicial</span>
          <input type="number" min="0" style={inputStyle} value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} />
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
