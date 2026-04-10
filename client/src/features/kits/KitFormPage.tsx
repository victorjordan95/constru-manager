import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useKit, useCreateKit, useUpdateKit } from './hooks'
import { useProducts } from '@/features/products/hooks'
import { formatCurrency } from '@/lib/format'
import type { KitItemPayload } from './types'

interface ItemRow {
  productId: string
  quantity: number
}

export function KitFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id
  const isEdit = Boolean(id)

  const { data: existing } = useKit(id ?? '', { enabled: isEdit })
  const { data: products } = useProducts()
  const createMutation = useCreateKit()
  const updateMutation = useUpdateKit()

  const [name, setName] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ productId: '', quantity: 1 }])
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setItems(
        existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      )
    }
  }, [existing])

  // Compute total price preview from current items and loaded product prices
  const productPriceMap = new Map(products?.map((p) => [p.id, p.finalPrice]) ?? [])
  const previewTotal = items.reduce((sum, row) => {
    const price = productPriceMap.get(row.productId) ?? 0
    return sum + price * row.quantity
  }, 0)

  function addItem() {
    setItems((prev) => [...prev, { productId: '', quantity: 1 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const validItems: KitItemPayload[] = items.filter(
      (row) => row.productId && row.quantity >= 1,
    )

    if (validItems.length === 0) {
      setServerError('Adicione pelo menos um item ao kit.')
      return
    }

    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload: { name, items: validItems } })
      } else {
        await createMutation.mutateAsync({ name, items: validItems })
      }
      void navigate({ to: '/kits' })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'INVALID_PRODUCT') {
        setServerError('Um ou mais produtos não encontrados ou inativos.')
      } else {
        setServerError('Erro ao salvar kit. Tente novamente.')
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
    width: '100%',
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Kit' : 'Novo Kit'}
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
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>
            Nome do Kit *
          </span>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
            Itens *
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((row, index) => (
              <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={row.productId}
                  onChange={(e) => updateItem(index, { productId: e.target.value })}
                  required
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">Selecione um produto</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.finalPrice)}{p.unit ? ` / ${p.unit}` : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value, 10) || 1 })}
                  required
                  style={{ ...inputStyle, width: 80 }}
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={{
                      background: 'var(--color-danger-bg)',
                      color: 'var(--color-danger)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            style={{
              marginTop: 8,
              background: 'none',
              border: '1px dashed var(--color-neutral-300)',
              padding: '6px var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--color-primary)',
              fontSize: '0.875rem',
              width: '100%',
            }}
          >
            + Adicionar item
          </button>
        </div>

        <div
          style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            padding: 'var(--space-1)',
            borderRadius: 4,
          }}
        >
          <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>Total estimado: </span>
          <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(previewTotal)}</strong>
        </div>

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
            onClick={() => void navigate({ to: '/kits' })}
            style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
