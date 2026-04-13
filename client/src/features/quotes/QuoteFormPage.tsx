import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateQuote } from './hooks'
import { useClients } from '@/features/clients/hooks'
import { useProducts } from '@/features/products/hooks'
import { useKits } from '@/features/kits/hooks'
import { formatCurrency } from '@/lib/format'
import type { QuoteItemPayload } from './types'

type ItemType = 'product' | 'kit'

interface ItemRow {
  _key: number
  type: ItemType
  productId: string
  kitId: string
  quantity: string
}

const emptyRow = (key: number): ItemRow => ({
  _key: key,
  type: 'product',
  productId: '',
  kitId: '',
  quantity: '1',
})

export function QuoteFormPage() {
  const navigate = useNavigate()
  const { data: clients } = useClients()
  const { data: products } = useProducts()
  const { data: kits } = useKits()
  const createMutation = useCreateQuote()

  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState<ItemRow[]>([emptyRow(0)])
  const [nextKey, setNextKey] = useState(1)
  const [laborCostStr, setLaborCostStr] = useState('0')
  const [discountStr, setDiscountStr] = useState('0')
  const [serverError, setServerError] = useState<string | null>(null)

  const productPriceMap = useMemo(
    () => new Map(products?.map((p) => [p.id, p.finalPrice]) ?? []),
    [products],
  )

  const kitPriceMap = useMemo(
    () => new Map(kits?.map((k) => [k.id, k.totalPrice]) ?? []),
    [kits],
  )

  const laborCostCents = Math.round(parseFloat(laborCostStr || '0') * 100)
  const discountCents = Math.round(parseFloat(discountStr || '0') * 100)

  const subtotal = useMemo(
    () =>
      items.reduce((sum, row) => {
        const qty = parseInt(row.quantity, 10)
        if (isNaN(qty) || qty < 1) return sum
        if (row.type === 'product') {
          return sum + (productPriceMap.get(row.productId) ?? 0) * qty
        }
        return sum + (kitPriceMap.get(row.kitId) ?? 0) * qty
      }, 0),
    [items, productPriceMap, kitPriceMap],
  )

  const total = subtotal + laborCostCents - discountCents

  function addItem() {
    setItems((prev) => [...prev, emptyRow(nextKey)])
    setNextKey((k) => k + 1)
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, patch: Partial<Omit<ItemRow, '_key'>>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    const validItems: QuoteItemPayload[] = items
      .map((row) => {
        const qty = parseInt(row.quantity, 10)
        if (isNaN(qty) || qty < 1) return null
        if (row.type === 'product' && row.productId) {
          return { productId: row.productId, quantity: qty } as QuoteItemPayload
        }
        if (row.type === 'kit' && row.kitId) {
          return { kitId: row.kitId, quantity: qty } as QuoteItemPayload
        }
        return null
      })
      .filter((x) => x !== null) as QuoteItemPayload[]

    if (validItems.length === 0) {
      setServerError('Adicione pelo menos um item ao orçamento.')
      return
    }

    try {
      const quote = await createMutation.mutateAsync({
        clientId,
        items: validItems,
        laborCost: laborCostCents,
        discount: discountCents,
      })
      void navigate({ to: '/quotes/$id', params: { id: quote.id } })
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'CLIENT_NOT_FOUND') {
        setServerError('Cliente não encontrado ou inativo.')
      } else if (code === 'INVALID_PRODUCT' || code === 'INVALID_KIT') {
        setServerError('Um ou mais itens não encontrados ou inativos.')
      } else {
        setServerError('Erro ao criar orçamento. Tente novamente.')
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

  const labelTextStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--color-neutral-600)',
    fontWeight: 500,
  }

  const isPending = createMutation.isPending

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>Novo Orçamento</h1>
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
        {/* Client */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={labelTextStyle}>Cliente *</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            style={inputStyle}
          >
            <option value="">Selecione um cliente</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {/* Items */}
        <div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
            Itens *
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((row, index) => (
              <div key={row._key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={row.type}
                  onChange={(e) =>
                    updateItem(index, {
                      type: e.target.value as ItemType,
                      productId: '',
                      kitId: '',
                    })
                  }
                  style={{ ...inputStyle, width: 110, flexShrink: 0 }}
                >
                  <option value="product">Produto</option>
                  <option value="kit">Kit</option>
                </select>
                {row.type === 'product' ? (
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
                ) : (
                  <select
                    value={row.kitId}
                    onChange={(e) => updateItem(index, { kitId: e.target.value })}
                    required
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="">Selecione um kit</option>
                    {kits?.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} — {formatCurrency(k.totalPrice)}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  required
                  style={{ ...inputStyle, width: 80, flexShrink: 0 }}
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

        {/* Labor cost + discount */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={labelTextStyle}>Mão de obra (R$)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={laborCostStr}
              onChange={(e) => setLaborCostStr(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={labelTextStyle}>Desconto (R$)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discountStr}
              onChange={(e) => setDiscountStr(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        {/* Live preview */}
        <div
          style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 4,
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'var(--color-neutral-600)' }}>
            Subtotal: {formatCurrency(subtotal)} · M.O.: +{formatCurrency(laborCostCents)} · Desconto: -{formatCurrency(discountCents)}
          </span>
          <strong style={{ color: 'var(--color-success)' }}>Total: {formatCurrency(total)}</strong>
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
            {isPending ? 'Criando...' : 'Criar Orçamento'}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/quotes' })}
            style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
