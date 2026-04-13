# Phase 5: Quotes Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build authenticated React pages for the Quotes feature — list, create, detail with version history, add revision, and accept/reject flow — wired to the Phase 4 Quotes API.

**Architecture:** Same pattern as Phase 3b. Each feature lives under `client/src/features/quotes/` with `types.ts` (API shapes), `api.ts` (axios calls), `hooks.ts` (TanStack Query), and page/modal components. All money values are integer cents; BRL display uses the existing `formatCurrency` helper. The accept flow is a separate `AcceptQuoteModal.tsx` component that renders inline when triggered. Status update buttons and the accept modal are embedded in `QuoteDetailPage.tsx`.

**Tech Stack:** React 19, TypeScript 6, TanStack Router v1 (code-based), TanStack Query v5, Zustand v5, Axios. No frontend test infrastructure exists — verification is TypeScript build (`npm run build` from `client/`) after each task.

---

## File Map

**New files:**
- `client/src/features/quotes/types.ts` — TypeScript interfaces matching every API response shape + all request payloads
- `client/src/features/quotes/api.ts` — axios API calls (listQuotes, getQuote, createQuote, addVersion, updateStatus, acceptQuote)
- `client/src/features/quotes/hooks.ts` — TanStack Query hooks for all 6 operations
- `client/src/features/quotes/QuotesListPage.tsx` — table of all quotes with status badge, client name, total, date
- `client/src/features/quotes/QuoteFormPage.tsx` — create new quote: client select, dynamic item rows (product OR kit), laborCost, discount, live total preview
- `client/src/features/quotes/QuoteDetailPage.tsx` — full quote view: header, active version items+totals, version history, sale info, status/accept actions
- `client/src/features/quotes/QuoteVersionFormPage.tsx` — add revision: dynamic item rows, laborCost, discount, live preview, posts to POST /quotes/:id/versions
- `client/src/features/quotes/AcceptQuoteModal.tsx` — inline modal for accepting a quote: paymentType, downPayment, optional dynamic installment rows
- `client/src/features/quotes/statusLabels.ts` — human-readable Portuguese labels + badge colors for QuoteStatus

**Modified files:**
- `client/src/features/quotes/index.ts` — barrel exports
- `client/src/router/index.tsx` — add 5 new routes (list, create, detail, add-version)
- `client/src/layouts/AppLayout.tsx` — add "Orçamentos" nav link (ADMIN + SALES)

---

### Task 1: Types + API + Hooks

**Files:**
- Create: `client/src/features/quotes/types.ts`
- Create: `client/src/features/quotes/api.ts`
- Create: `client/src/features/quotes/hooks.ts`
- Create: `client/src/features/quotes/statusLabels.ts`
- Modify: `client/src/features/quotes/index.ts`

- [ ] **Step 1: Create `client/src/features/quotes/types.ts`**

```typescript
export type QuoteStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'NO_RESPONSE'

// ─── List shape (GET /quotes) ─────────────────────────────────────────────────

export interface QuoteListItem {
  id: string
  status: QuoteStatus
  createdAt: string
  updatedAt: string
  client: { id: string; name: string }
  activeVersion: {
    id: string
    version: number
    subtotal: number
    laborCost: number
    discount: number
    total: number
    createdAt: string
  } | null
}

// ─── Detail shape (GET /quotes/:id) ──────────────────────────────────────────

export interface QuoteItem {
  id: string
  quantity: number
  unitPrice: number
  lineTotal: number
  productId: string | null
  kitId: string | null
  product: { id: string; name: string; unit: string | null } | null
  kit: { id: string; name: string } | null
}

export interface QuoteVersion {
  id: string
  version: number
  subtotal: number
  laborCost: number
  discount: number
  total: number
  createdAt: string
  items: QuoteItem[]
}

export interface Installment {
  id: string
  dueDate: string
  amount: number
  isPaid: boolean
}

export interface Sale {
  id: string
  paymentType: 'LUMP_SUM' | 'INSTALLMENTS'
  downPayment: number
  total: number
  installments: Installment[]
}

export interface Quote {
  id: string
  status: QuoteStatus
  createdAt: string
  updatedAt: string
  client: { id: string; name: string }
  activeVersion: QuoteVersion | null
  versions: QuoteVersion[]
  sale: Sale | null
}

// ─── Request payloads ─────────────────────────────────────────────────────────

export interface QuoteItemPayload {
  productId?: string
  kitId?: string
  quantity: number
}

export interface CreateQuotePayload {
  clientId: string
  items: QuoteItemPayload[]
  laborCost: number
  discount: number
}

export interface AddVersionPayload {
  items: QuoteItemPayload[]
  laborCost: number
  discount: number
}

export interface UpdateStatusPayload {
  status: 'PENDING_REVIEW' | 'REJECTED' | 'NO_RESPONSE'
}

export interface InstallmentPayload {
  dueDate: string // ISO 8601 datetime, e.g. "2026-06-01T00:00:00.000Z"
  amount: number  // integer cents
}

export interface AcceptQuotePayload {
  paymentType: 'LUMP_SUM' | 'INSTALLMENTS'
  downPayment: number
  installments?: InstallmentPayload[]
}
```

- [ ] **Step 2: Create `client/src/features/quotes/statusLabels.ts`**

```typescript
import type { QuoteStatus } from './types'

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_REVIEW: 'Em Análise',
  ACCEPTED: 'Aceito',
  REJECTED: 'Rejeitado',
  NO_RESPONSE: 'Sem Retorno',
}

export const STATUS_COLOR: Record<QuoteStatus, { bg: string; text: string }> = {
  DRAFT: { bg: 'var(--color-neutral-200)', text: 'var(--color-neutral-700)' },
  PENDING_REVIEW: { bg: '#fff3cd', text: '#856404' },
  ACCEPTED: { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  REJECTED: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger)' },
  NO_RESPONSE: { bg: '#e2e3e5', text: '#41464b' },
}
```

- [ ] **Step 3: Create `client/src/features/quotes/api.ts`**

```typescript
import { api } from '@/lib/axios'
import type {
  QuoteListItem,
  Quote,
  CreateQuotePayload,
  AddVersionPayload,
  UpdateStatusPayload,
  AcceptQuotePayload,
} from './types'

export async function listQuotes(): Promise<QuoteListItem[]> {
  const { data } = await api.get<QuoteListItem[]>('/quotes')
  return data
}

export async function getQuote(id: string): Promise<Quote> {
  const { data } = await api.get<Quote>(`/quotes/${id}`)
  return data
}

export async function createQuote(payload: CreateQuotePayload): Promise<Quote> {
  const { data } = await api.post<Quote>('/quotes', payload)
  return data
}

export async function addVersion(id: string, payload: AddVersionPayload): Promise<Quote> {
  const { data } = await api.post<Quote>(`/quotes/${id}/versions`, payload)
  return data
}

export async function updateStatus(id: string, payload: UpdateStatusPayload): Promise<Quote> {
  const { data } = await api.patch<Quote>(`/quotes/${id}/status`, payload)
  return data
}

export async function acceptQuote(id: string, payload: AcceptQuotePayload): Promise<Quote> {
  const { data } = await api.post<Quote>(`/quotes/${id}/accept`, payload)
  return data
}
```

- [ ] **Step 4: Create `client/src/features/quotes/hooks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listQuotes,
  getQuote,
  createQuote,
  addVersion,
  updateStatus,
  acceptQuote,
} from './api'
import type {
  CreateQuotePayload,
  AddVersionPayload,
  UpdateStatusPayload,
  AcceptQuotePayload,
} from './types'

export function useQuotes() {
  return useQuery({ queryKey: ['quotes'], queryFn: listQuotes })
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: () => getQuote(id),
    enabled: Boolean(id),
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateQuotePayload) => createQuote(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

export function useAddVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AddVersionPayload }) =>
      addVersion(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['quotes', id] })
      void qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStatusPayload }) =>
      updateStatus(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['quotes', id] })
      void qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useAcceptQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AcceptQuotePayload }) =>
      acceptQuote(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['quotes', id] })
      void qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}
```

- [ ] **Step 5: Update `client/src/features/quotes/index.ts`**

```typescript
export * from './types'
export * from './api'
export * from './hooks'
export * from './statusLabels'
export { QuotesListPage } from './QuotesListPage'
export { QuoteFormPage } from './QuoteFormPage'
export { QuoteDetailPage } from './QuoteDetailPage'
export { QuoteVersionFormPage } from './QuoteVersionFormPage'
```

> Note: The page components don't exist yet — the index.ts will cause a build error until all pages are created. Leave it empty (as-is) for now; it will be completed in Task 6.

Actually, keep `index.ts` as:
```typescript
// Quotes feature public API — export components, hooks, types here as they are built
export * from './types'
export * from './api'
export * from './hooks'
export * from './statusLabels'
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd C:/freela/constru-manager/client && npm run build 2>&1 | tail -20
```

Expected: build succeeds (no errors from the data layer files).

- [ ] **Step 7: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/types.ts client/src/features/quotes/api.ts client/src/features/quotes/hooks.ts client/src/features/quotes/statusLabels.ts client/src/features/quotes/index.ts
git commit -m "feat(quotes-ui): add types, API calls, and TanStack Query hooks"
```

---

### Task 2: QuotesListPage + router wiring + nav link

**Files:**
- Create: `client/src/features/quotes/QuotesListPage.tsx`
- Modify: `client/src/router/index.tsx`
- Modify: `client/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Create `client/src/features/quotes/QuotesListPage.tsx`**

```typescript
import { Link } from '@tanstack/react-router'
import { useQuotes } from './hooks'
import { STATUS_LABEL, STATUS_COLOR } from './statusLabels'
import { formatCurrency } from '@/lib/format'
import { useAuthStore } from '@/stores/authStore'

export function QuotesListPage() {
  const { data: quotes, isLoading, error } = useQuotes()
  const { user } = useAuthStore()

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar orçamentos.</p>

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Orçamentos</h1>
        {(user?.role === 'ADMIN' || user?.role === 'SALES') && (
          <Link to="/quotes/new">
            <button
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-surface)',
                border: 'none',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + Novo Orçamento
            </button>
          </Link>
        )}
      </div>
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-bg)' }}>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Versão</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Data</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {quotes?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--color-neutral-600)' }}>
                  Nenhum orçamento cadastrado.
                </td>
              </tr>
            )}
            {quotes?.map((q) => {
              const colors = STATUS_COLOR[q.status]
              return (
                <tr key={q.id} style={{ borderTop: '1px solid var(--color-neutral-300)' }}>
                  <td style={tdStyle}>{q.client.name}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {STATUS_LABEL[q.status]}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-neutral-600)' }}>
                    {q.activeVersion ? `v${q.activeVersion.version}` : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {q.activeVersion ? formatCurrency(q.activeVersion.total) : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-neutral-600)', fontSize: '0.875rem' }}>
                    {new Date(q.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={tdStyle}>
                    <Link to="/quotes/$id" params={{ id: q.id }}>
                      <button
                        style={{
                          background: 'var(--color-primary-bg)',
                          color: 'var(--color-primary)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Ver
                      </button>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  textAlign: 'left',
  fontSize: '0.875rem',
  color: 'var(--color-primary)',
}

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
}
```

- [ ] **Step 2: Add stub pages to avoid import errors**

`QuoteFormPage`, `QuoteDetailPage`, and `QuoteVersionFormPage` must exist before the router imports them. Create each as a minimal stub now — they will be replaced in Tasks 3, 4, and 5.

Create `client/src/features/quotes/QuoteFormPage.tsx`:
```typescript
export function QuoteFormPage() {
  return <p style={{ color: 'var(--color-neutral-600)' }}>Formulário de orçamento em breve.</p>
}
```

Create `client/src/features/quotes/QuoteDetailPage.tsx`:
```typescript
export function QuoteDetailPage() {
  return <p style={{ color: 'var(--color-neutral-600)' }}>Detalhes do orçamento em breve.</p>
}
```

Create `client/src/features/quotes/QuoteVersionFormPage.tsx`:
```typescript
export function QuoteVersionFormPage() {
  return <p style={{ color: 'var(--color-neutral-600)' }}>Nova versão em breve.</p>
}
```

- [ ] **Step 3: Add routes to `client/src/router/index.tsx`**

Add these imports at the top (after the existing kit imports):
```typescript
import { QuotesListPage } from '@/features/quotes/QuotesListPage'
import { QuoteFormPage } from '@/features/quotes/QuoteFormPage'
import { QuoteDetailPage } from '@/features/quotes/QuoteDetailPage'
import { QuoteVersionFormPage } from '@/features/quotes/QuoteVersionFormPage'
```

Add these route definitions (after `kitEditRoute`):
```typescript
const quotesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes',
  component: QuotesListPage,
})

const quoteCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes/new',
  component: QuoteFormPage,
})

const quoteDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes/$id',
  component: QuoteDetailPage,
})

const quoteAddVersionRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quotes/$id/versions/new',
  component: QuoteVersionFormPage,
})
```

Update `routeTree` to include the new routes (add inside `authenticatedRoute.addChildren([...])`):
```typescript
const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    indexRoute,
    clientsRoute,
    clientCreateRoute,
    clientEditRoute,
    productsRoute,
    productCreateRoute,
    productEditRoute,
    kitsRoute,
    kitCreateRoute,
    kitEditRoute,
    quotesRoute,
    quoteCreateRoute,
    quoteDetailRoute,
    quoteAddVersionRoute,
  ]),
])
```

- [ ] **Step 4: Add "Orçamentos" link to `client/src/layouts/AppLayout.tsx`**

After the Kits `<li>` block (the one with `user?.role === 'ADMIN'`), add:
```typescript
{(user?.role === 'SALES' || user?.role === 'ADMIN') && (
  <li>
    <Link to="/quotes" style={linkStyle}>
      Orçamentos
    </Link>
  </li>
)}
```

- [ ] **Step 5: Verify build**

```bash
cd C:/freela/constru-manager/client && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/QuotesListPage.tsx client/src/features/quotes/QuoteFormPage.tsx client/src/features/quotes/QuoteDetailPage.tsx client/src/features/quotes/QuoteVersionFormPage.tsx client/src/router/index.tsx client/src/layouts/AppLayout.tsx
git commit -m "feat(quotes-ui): add QuotesListPage, route wiring, and nav link"
```

---

### Task 3: QuoteFormPage (create new quote)

**Files:**
- Replace: `client/src/features/quotes/QuoteFormPage.tsx`

This page creates a new quote. Each item row has a `type` toggle (Produto / Kit), a select dropdown, and a quantity. `laborCost` and `discount` accept decimal BRL input and are converted to integer cents on submit.

- [ ] **Step 1: Replace `client/src/features/quotes/QuoteFormPage.tsx`**

```typescript
import { useState, useEffect, useMemo } from 'react'
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
          return { productId: row.productId, quantity: qty }
        }
        if (row.type === 'kit' && row.kitId) {
          return { kitId: row.kitId, quantity: qty }
        }
        return null
      })
      .filter((x): x is QuoteItemPayload => x !== null)

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
    } catch {
      setServerError('Erro ao criar orçamento. Tente novamente.')
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
    width: '100%',
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
                {/* Type toggle */}
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
                {/* Product or Kit dropdown */}
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
                {/* Quantity */}
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

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--color-neutral-600)',
  fontWeight: 500,
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/freela/constru-manager/client && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/QuoteFormPage.tsx
git commit -m "feat(quotes-ui): implement QuoteFormPage (create quote with items)"
```

---

### Task 4: QuoteDetailPage (read-only view)

**Files:**
- Replace: `client/src/features/quotes/QuoteDetailPage.tsx`

This page shows full quote info: client, status badge, active version items+totals, full version history, and sale info (if accepted). Status actions and the accept modal are added in Task 6 — this task renders read-only content only.

- [ ] **Step 1: Replace `client/src/features/quotes/QuoteDetailPage.tsx`**

```typescript
import { Link, useParams } from '@tanstack/react-router'
import { useQuote } from './hooks'
import { STATUS_LABEL, STATUS_COLOR } from './statusLabels'
import { formatCurrency } from '@/lib/format'
import { useAuthStore } from '@/stores/authStore'
import type { QuoteVersion } from './types'

export function QuoteDetailPage() {
  const params = useParams({ strict: false }) as { id: string }
  const { data: quote, isLoading, error } = useQuote(params.id)
  const { user } = useAuthStore()

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error || !quote) return <p style={{ color: 'var(--color-danger)' }}>Orçamento não encontrado.</p>

  const colors = STATUS_COLOR[quote.status]
  const canAddVersion = quote.status !== 'ACCEPTED' && (user?.role === 'ADMIN' || user?.role === 'SALES')

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <Link to="/quotes" style={{ color: 'var(--color-primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
            ← Orçamentos
          </Link>
          <h1 style={{ fontSize: '1.5rem', marginTop: 4 }}>{quote.client.name}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', marginTop: 2 }}>
            Criado em {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span
            style={{
              background: colors.bg,
              color: colors.text,
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {STATUS_LABEL[quote.status]}
          </span>
          {canAddVersion && (
            <Link to="/quotes/$id/versions/new" params={{ id: quote.id }}>
              <button
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--color-surface)',
                  border: 'none',
                  padding: '6px var(--space-2)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                + Nova Versão
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Active version */}
      {quote.activeVersion && (
        <VersionCard version={quote.activeVersion} isActive />
      )}

      {/* Version history */}
      {quote.versions.length > 1 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Histórico de versões
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {quote.versions
              .filter((v) => v.id !== quote.activeVersion?.id)
              .map((v) => (
                <VersionCard key={v.id} version={v} isActive={false} />
              ))}
          </div>
        </div>
      )}

      {/* Sale info */}
      {quote.sale && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            borderRadius: 8,
            padding: 'var(--space-2) var(--space-3)',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-success)' }}>
            Venda Registrada
          </h2>
          <p style={{ fontSize: '0.875rem' }}>
            Tipo: <strong>{quote.sale.paymentType === 'LUMP_SUM' ? 'À vista' : 'Parcelado'}</strong>
            {quote.sale.downPayment > 0 && (
              <> · Entrada: <strong>{formatCurrency(quote.sale.downPayment)}</strong></>
            )}
            {' '}· Total: <strong>{formatCurrency(quote.sale.total)}</strong>
          </p>
          {quote.sale.installments.length > 0 && (
            <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Vencimento</th>
                  <th style={{ textAlign: 'right', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Valor</th>
                  <th style={{ textAlign: 'right', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {quote.sale.installments.map((inst) => (
                  <tr key={inst.id}>
                    <td style={{ paddingTop: 4 }}>{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td style={{ paddingTop: 4, textAlign: 'right' }}>{formatCurrency(inst.amount)}</td>
                    <td style={{ paddingTop: 4, textAlign: 'right', color: inst.isPaid ? 'var(--color-success)' : 'var(--color-neutral-600)' }}>
                      {inst.isPaid ? 'Pago' : 'Pendente'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function VersionCard({ version, isActive }: { version: QuoteVersion; isActive: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-neutral-300)'}`,
        borderRadius: 8,
        padding: 'var(--space-2) var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>
          Versão {version.version}
          {isActive && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-primary)', background: 'var(--color-primary-bg)', padding: '2px 6px', borderRadius: 10 }}>
              ativa
            </span>
          )}
        </span>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
          {new Date(version.createdAt).toLocaleDateString('pt-BR')}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: 'var(--color-neutral-100)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Item</th>
            <th style={{ textAlign: 'center', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Qtd</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Unit.</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {version.items.map((item) => (
            <tr key={item.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
              <td style={{ padding: '4px 8px' }}>
                {item.product
                  ? `${item.product.name}${item.product.unit ? ` (${item.product.unit})` : ''}`
                  : item.kit?.name ?? '—'}
                {item.kit && <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-600)', marginLeft: 4 }}>[kit]</span>}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 8, fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--color-neutral-600)' }}>Subtotal: {formatCurrency(version.subtotal)}</span>
        {version.laborCost > 0 && (
          <span style={{ color: 'var(--color-neutral-600)' }}>M.O.: +{formatCurrency(version.laborCost)}</span>
        )}
        {version.discount > 0 && (
          <span style={{ color: 'var(--color-neutral-600)' }}>Desconto: -{formatCurrency(version.discount)}</span>
        )}
        <strong>Total: {formatCurrency(version.total)}</strong>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/freela/constru-manager/client && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/QuoteDetailPage.tsx
git commit -m "feat(quotes-ui): implement QuoteDetailPage (read-only view with version history)"
```

---

### Task 5: QuoteVersionFormPage (add new revision)

**Files:**
- Replace: `client/src/features/quotes/QuoteVersionFormPage.tsx`

Prefills the form with items from the current active version so the user can adjust and submit. Posts to `POST /quotes/:id/versions`.

- [ ] **Step 1: Replace `client/src/features/quotes/QuoteVersionFormPage.tsx`**

```typescript
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQuote, useAddVersion } from './hooks'
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

export function QuoteVersionFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id: string }
  const { data: quote } = useQuote(params.id)
  const { data: products } = useProducts()
  const { data: kits } = useKits()
  const addVersionMutation = useAddVersion()

  const [items, setItems] = useState<ItemRow[]>([emptyRow(0)])
  const [nextKey, setNextKey] = useState(1)
  const [laborCostStr, setLaborCostStr] = useState('0')
  const [discountStr, setDiscountStr] = useState('0')
  const [prefilled, setPrefilled] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Prefill from active version when data arrives
  useEffect(() => {
    if (prefilled || !quote?.activeVersion) return
    const av = quote.activeVersion
    const rows: ItemRow[] = av.items.map((item, idx) => ({
      _key: idx,
      type: item.productId ? 'product' : 'kit',
      productId: item.productId ?? '',
      kitId: item.kitId ?? '',
      quantity: String(item.quantity),
    }))
    setItems(rows)
    setNextKey(rows.length)
    setLaborCostStr((av.laborCost / 100).toFixed(2))
    setDiscountStr((av.discount / 100).toFixed(2))
    setPrefilled(true)
  }, [quote, prefilled])

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
        if (row.type === 'product') return sum + (productPriceMap.get(row.productId) ?? 0) * qty
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
        if (row.type === 'product' && row.productId) return { productId: row.productId, quantity: qty }
        if (row.type === 'kit' && row.kitId) return { kitId: row.kitId, quantity: qty }
        return null
      })
      .filter((x): x is QuoteItemPayload => x !== null)

    if (validItems.length === 0) {
      setServerError('Adicione pelo menos um item.')
      return
    }

    try {
      await addVersionMutation.mutateAsync({
        id: params.id,
        payload: { items: validItems, laborCost: laborCostCents, discount: discountCents },
      })
      void navigate({ to: '/quotes/$id', params: { id: params.id } })
    } catch {
      setServerError('Erro ao adicionar versão. Tente novamente.')
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
    width: '100%',
  }

  const isPending = addVersionMutation.isPending
  const nextVersionNumber = (quote?.versions.length ?? 0) + 1

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); void navigate({ to: '/quotes/$id', params: { id: params.id } }) }}
          style={{ color: 'var(--color-primary)', fontSize: '0.875rem', textDecoration: 'none' }}
        >
          ← Voltar ao Orçamento
        </a>
        <h1 style={{ fontSize: '1.5rem', marginTop: 4 }}>
          Nova Versão (v{nextVersionNumber})
        </h1>
      </div>
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
                  onChange={(e) => updateItem(index, { type: e.target.value as ItemType, productId: '', kitId: '' })}
                  style={{ ...inputStyle, width: 110, flexShrink: 0 }}
                >
                  <option value="product">Produto</option>
                  <option value="kit">Kit</option>
                </select>
                {row.type === 'product' ? (
                  <select value={row.productId} onChange={(e) => updateItem(index, { productId: e.target.value })} required style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Selecione um produto</option>
                    {products?.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.finalPrice)}{p.unit ? ` / ${p.unit}` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <select value={row.kitId} onChange={(e) => updateItem(index, { kitId: e.target.value })} required style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Selecione um kit</option>
                    {kits?.map((k) => (
                      <option key={k.id} value={k.id}>{k.name} — {formatCurrency(k.totalPrice)}</option>
                    ))}
                  </select>
                )}
                <input type="number" min="1" value={row.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} required style={{ ...inputStyle, width: 80, flexShrink: 0 }} />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(index)} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}>×</button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addItem} style={{ marginTop: 8, background: 'none', border: '1px dashed var(--color-neutral-300)', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.875rem', width: '100%' }}>
            + Adicionar item
          </button>
        </div>

        {/* Labor + Discount */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>Mão de obra (R$)</span>
            <input type="number" min="0" step="0.01" value={laborCostStr} onChange={(e) => setLaborCostStr(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>Desconto (R$)</span>
            <input type="number" min="0" step="0.01" value={discountStr} onChange={(e) => setDiscountStr(e.target.value)} style={inputStyle} />
          </label>
        </div>

        {/* Preview */}
        <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--color-neutral-600)' }}>Subtotal: {formatCurrency(subtotal)} · M.O.: +{formatCurrency(laborCostCents)} · Desconto: -{formatCurrency(discountCents)}</span>
          <strong style={{ color: 'var(--color-success)' }}>Total: {formatCurrency(total)}</strong>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
          <button type="submit" disabled={isPending} style={{ background: 'var(--color-primary)', color: 'var(--color-surface)', border: 'none', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isPending ? 0.7 : 1 }}>
            {isPending ? 'Salvando...' : 'Salvar Versão'}
          </button>
          <button type="button" onClick={() => void navigate({ to: '/quotes/$id', params: { id: params.id } })} style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/freela/constru-manager/client && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/QuoteVersionFormPage.tsx
git commit -m "feat(quotes-ui): implement QuoteVersionFormPage (add revision, prefilled from active)"
```

---

### Task 6: Status actions + AcceptQuoteModal in QuoteDetailPage

**Files:**
- Create: `client/src/features/quotes/AcceptQuoteModal.tsx`
- Modify: `client/src/features/quotes/QuoteDetailPage.tsx`
- Modify: `client/src/features/quotes/index.ts`

Add ADMIN-only status update buttons and the accept flow to `QuoteDetailPage`. The accept modal is a separate component rendered inline (not a real dialog — just a conditional block that overlays with a dimmed background).

- [ ] **Step 1: Create `client/src/features/quotes/AcceptQuoteModal.tsx`**

```typescript
import { useState, useMemo } from 'react'
import { useAcceptQuote } from './hooks'
import { formatCurrency } from '@/lib/format'
import type { InstallmentPayload } from './types'

interface InstallmentRow {
  _key: number
  dueDate: string   // date string from <input type="date">
  amountStr: string // decimal BRL string
}

const emptyInstRow = (key: number): InstallmentRow => ({
  _key: key,
  dueDate: '',
  amountStr: '',
})

interface Props {
  quoteId: string
  onClose: () => void
}

export function AcceptQuoteModal({ quoteId, onClose }: Props) {
  const acceptMutation = useAcceptQuote()
  const [paymentType, setPaymentType] = useState<'LUMP_SUM' | 'INSTALLMENTS'>('LUMP_SUM')
  const [downPaymentStr, setDownPaymentStr] = useState('0')
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([emptyInstRow(0)])
  const [nextKey, setNextKey] = useState(1)
  const [serverError, setServerError] = useState<string | null>(null)

  const downPaymentCents = Math.round(parseFloat(downPaymentStr || '0') * 100)

  const installmentTotal = useMemo(
    () =>
      installmentRows.reduce((sum, row) => {
        const v = parseFloat(row.amountStr || '0')
        return sum + Math.round(isNaN(v) ? 0 : v * 100)
      }, 0),
    [installmentRows],
  )

  function addRow() {
    setInstallmentRows((prev) => [...prev, emptyInstRow(nextKey)])
    setNextKey((k) => k + 1)
  }

  function removeRow(index: number) {
    setInstallmentRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, patch: Partial<Omit<InstallmentRow, '_key'>>) {
    setInstallmentRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)

    let installments: InstallmentPayload[] | undefined
    if (paymentType === 'INSTALLMENTS') {
      const rows = installmentRows
        .map((row) => {
          const amount = Math.round(parseFloat(row.amountStr || '0') * 100)
          if (!row.dueDate || amount < 1) return null
          // Convert date "YYYY-MM-DD" to ISO datetime
          return { dueDate: `${row.dueDate}T00:00:00.000Z`, amount }
        })
        .filter((x): x is InstallmentPayload => x !== null)

      if (rows.length === 0) {
        setServerError('Adicione pelo menos uma parcela.')
        return
      }
      installments = rows
    }

    try {
      await acceptMutation.mutateAsync({
        id: quoteId,
        payload: {
          paymentType,
          downPayment: downPaymentCents,
          ...(installments && { installments }),
        },
      })
      onClose()
    } catch {
      setServerError('Erro ao aceitar orçamento. Tente novamente.')
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: 'var(--space-1)',
    borderRadius: 4,
    border: '1px solid var(--color-neutral-300)',
    fontSize: '1rem',
    width: '100%',
  }

  const isPending = acceptMutation.isPending

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          padding: 'var(--space-3)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--color-neutral-300)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Aceitar Orçamento</h2>
        {serverError && (
          <p style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: 'var(--space-1)', borderRadius: 4, marginBottom: 'var(--space-2)' }}>
            {serverError}
          </p>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {/* Payment type */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>Forma de pagamento</span>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as 'LUMP_SUM' | 'INSTALLMENTS')} style={inputStyle}>
              <option value="LUMP_SUM">À vista</option>
              <option value="INSTALLMENTS">Parcelado</option>
            </select>
          </label>

          {/* Down payment */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>Entrada (R$)</span>
            <input type="number" min="0" step="0.01" value={downPaymentStr} onChange={(e) => setDownPaymentStr(e.target.value)} style={inputStyle} />
          </label>

          {/* Installments */}
          {paymentType === 'INSTALLMENTS' && (
            <div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500, marginBottom: 8 }}>
                Parcelas
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {installmentRows.map((row, index) => (
                  <div key={row._key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => updateRow(index, { dueDate: e.target.value })}
                      required
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Valor (R$)"
                      value={row.amountStr}
                      onChange={(e) => updateRow(index, { amountStr: e.target.value })}
                      required
                      style={{ ...inputStyle, width: 130, flexShrink: 0 }}
                    />
                    {installmentRows.length > 1 && (
                      <button type="button" onClick={() => removeRow(index)} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addRow} style={{ marginTop: 8, background: 'none', border: '1px dashed var(--color-neutral-300)', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.875rem', width: '100%' }}>
                + Adicionar parcela
              </button>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginTop: 4 }}>
                Total das parcelas: {formatCurrency(installmentTotal)}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-1)', paddingTop: 'var(--space-1)' }}>
            <button type="submit" disabled={isPending} style={{ background: 'var(--color-success)', color: 'var(--color-surface)', border: 'none', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: isPending ? 0.7 : 1 }}>
              {isPending ? 'Confirmando...' : 'Confirmar Aceitação'}
            </button>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid var(--color-neutral-300)', padding: 'var(--space-1) var(--space-2)', borderRadius: 4, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modify `client/src/features/quotes/QuoteDetailPage.tsx` to add status actions and accept modal**

At the top of the file, add the import:
```typescript
import { useState } from 'react'
import { AcceptQuoteModal } from './AcceptQuoteModal'
import { useUpdateStatus } from './hooks'
```

Inside `QuoteDetailPage`, add these state declarations after the existing hooks:
```typescript
const [showAcceptModal, setShowAcceptModal] = useState(false)
const updateStatusMutation = useUpdateStatus()
const isAdmin = user?.role === 'ADMIN'
const canAccept = isAdmin && quote.status !== 'ACCEPTED' && quote.activeVersion !== null
const canChangeStatus = isAdmin && quote.status !== 'ACCEPTED'
```

In the JSX, after the status badge `<span>` and before (or after) the "Nova Versão" button, add the ADMIN action buttons:
```typescript
{canChangeStatus && (
  <>
    {quote.status !== 'PENDING_REVIEW' && (
      <button
        disabled={updateStatusMutation.isPending}
        onClick={() => updateStatusMutation.mutate({ id: quote.id, payload: { status: 'PENDING_REVIEW' } })}
        style={{ background: '#fff3cd', color: '#856404', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
      >
        Em Análise
      </button>
    )}
    {quote.status !== 'REJECTED' && (
      <button
        disabled={updateStatusMutation.isPending}
        onClick={() => {
          if (confirm('Rejeitar este orçamento?')) {
            updateStatusMutation.mutate({ id: quote.id, payload: { status: 'REJECTED' } })
          }
        }}
        style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
      >
        Rejeitar
      </button>
    )}
    {quote.status !== 'NO_RESPONSE' && (
      <button
        disabled={updateStatusMutation.isPending}
        onClick={() => updateStatusMutation.mutate({ id: quote.id, payload: { status: 'NO_RESPONSE' } })}
        style={{ background: '#e2e3e5', color: '#41464b', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
      >
        Sem Retorno
      </button>
    )}
  </>
)}
{canAccept && (
  <button
    onClick={() => setShowAcceptModal(true)}
    style={{ background: 'var(--color-success)', color: 'var(--color-surface)', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
  >
    Aceitar
  </button>
)}
```

At the very bottom of the returned JSX (after the closing `</div>`), add:
```typescript
{showAcceptModal && (
  <AcceptQuoteModal quoteId={quote.id} onClose={() => setShowAcceptModal(false)} />
)}
```

The full updated `QuoteDetailPage.tsx` (complete file — replaces the Task 4 stub entirely):

```typescript
import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useQuote, useUpdateStatus } from './hooks'
import { AcceptQuoteModal } from './AcceptQuoteModal'
import { STATUS_LABEL, STATUS_COLOR } from './statusLabels'
import { formatCurrency } from '@/lib/format'
import { useAuthStore } from '@/stores/authStore'
import type { QuoteVersion } from './types'

export function QuoteDetailPage() {
  const params = useParams({ strict: false }) as { id: string }
  const { data: quote, isLoading, error } = useQuote(params.id)
  const { user } = useAuthStore()
  const updateStatusMutation = useUpdateStatus()
  const [showAcceptModal, setShowAcceptModal] = useState(false)

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error || !quote) return <p style={{ color: 'var(--color-danger)' }}>Orçamento não encontrado.</p>

  const colors = STATUS_COLOR[quote.status]
  const isAdmin = user?.role === 'ADMIN'
  const canAddVersion = quote.status !== 'ACCEPTED' && (user?.role === 'ADMIN' || user?.role === 'SALES')
  const canChangeStatus = isAdmin && quote.status !== 'ACCEPTED'
  const canAccept = isAdmin && quote.status !== 'ACCEPTED' && quote.activeVersion !== null

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <Link to="/quotes" style={{ color: 'var(--color-primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
            ← Orçamentos
          </Link>
          <h1 style={{ fontSize: '1.5rem', marginTop: 4 }}>{quote.client.name}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', marginTop: 2 }}>
            Criado em {new Date(quote.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span
            style={{
              background: colors.bg,
              color: colors.text,
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {STATUS_LABEL[quote.status]}
          </span>
          {canChangeStatus && (
            <>
              {quote.status !== 'PENDING_REVIEW' && (
                <button
                  disabled={updateStatusMutation.isPending}
                  onClick={() => updateStatusMutation.mutate({ id: quote.id, payload: { status: 'PENDING_REVIEW' } })}
                  style={{ background: '#fff3cd', color: '#856404', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Em Análise
                </button>
              )}
              {quote.status !== 'REJECTED' && (
                <button
                  disabled={updateStatusMutation.isPending}
                  onClick={() => {
                    if (confirm('Rejeitar este orçamento?')) {
                      updateStatusMutation.mutate({ id: quote.id, payload: { status: 'REJECTED' } })
                    }
                  }}
                  style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Rejeitar
                </button>
              )}
              {quote.status !== 'NO_RESPONSE' && (
                <button
                  disabled={updateStatusMutation.isPending}
                  onClick={() => updateStatusMutation.mutate({ id: quote.id, payload: { status: 'NO_RESPONSE' } })}
                  style={{ background: '#e2e3e5', color: '#41464b', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Sem Retorno
                </button>
              )}
            </>
          )}
          {canAccept && (
            <button
              onClick={() => setShowAcceptModal(true)}
              style={{ background: 'var(--color-success)', color: 'var(--color-surface)', border: 'none', padding: '6px var(--space-2)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
            >
              Aceitar
            </button>
          )}
          {canAddVersion && (
            <Link to="/quotes/$id/versions/new" params={{ id: quote.id }}>
              <button
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--color-surface)',
                  border: 'none',
                  padding: '6px var(--space-2)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                + Nova Versão
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Active version */}
      {quote.activeVersion && (
        <VersionCard version={quote.activeVersion} isActive />
      )}

      {/* Version history */}
      {quote.versions.length > 1 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Histórico de versões
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {quote.versions
              .filter((v) => v.id !== quote.activeVersion?.id)
              .map((v) => (
                <VersionCard key={v.id} version={v} isActive={false} />
              ))}
          </div>
        </div>
      )}

      {/* Sale info */}
      {quote.sale && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            borderRadius: 8,
            padding: 'var(--space-2) var(--space-3)',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-success)' }}>
            Venda Registrada
          </h2>
          <p style={{ fontSize: '0.875rem' }}>
            Tipo: <strong>{quote.sale.paymentType === 'LUMP_SUM' ? 'À vista' : 'Parcelado'}</strong>
            {quote.sale.downPayment > 0 && (
              <> · Entrada: <strong>{formatCurrency(quote.sale.downPayment)}</strong></>
            )}
            {' '}· Total: <strong>{formatCurrency(quote.sale.total)}</strong>
          </p>
          {quote.sale.installments.length > 0 && (
            <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Vencimento</th>
                  <th style={{ textAlign: 'right', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Valor</th>
                  <th style={{ textAlign: 'right', paddingBottom: 4, color: 'var(--color-neutral-600)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {quote.sale.installments.map((inst) => (
                  <tr key={inst.id}>
                    <td style={{ paddingTop: 4 }}>{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td style={{ paddingTop: 4, textAlign: 'right' }}>{formatCurrency(inst.amount)}</td>
                    <td style={{ paddingTop: 4, textAlign: 'right', color: inst.isPaid ? 'var(--color-success)' : 'var(--color-neutral-600)' }}>
                      {inst.isPaid ? 'Pago' : 'Pendente'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Accept modal */}
      {showAcceptModal && (
        <AcceptQuoteModal quoteId={quote.id} onClose={() => setShowAcceptModal(false)} />
      )}
    </div>
  )
}

function VersionCard({ version, isActive }: { version: QuoteVersion; isActive: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-neutral-300)'}`,
        borderRadius: 8,
        padding: 'var(--space-2) var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>
          Versão {version.version}
          {isActive && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--color-primary)', background: 'var(--color-primary-bg)', padding: '2px 6px', borderRadius: 10 }}>
              ativa
            </span>
          )}
        </span>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)' }}>
          {new Date(version.createdAt).toLocaleDateString('pt-BR')}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: 'var(--color-neutral-100)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Item</th>
            <th style={{ textAlign: 'center', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Qtd</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Unit.</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--color-neutral-600)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {version.items.map((item) => (
            <tr key={item.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
              <td style={{ padding: '4px 8px' }}>
                {item.product
                  ? `${item.product.name}${item.product.unit ? ` (${item.product.unit})` : ''}`
                  : item.kit?.name ?? '—'}
                {item.kit && <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-600)', marginLeft: 4 }}>[kit]</span>}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 8, fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--color-neutral-600)' }}>Subtotal: {formatCurrency(version.subtotal)}</span>
        {version.laborCost > 0 && (
          <span style={{ color: 'var(--color-neutral-600)' }}>M.O.: +{formatCurrency(version.laborCost)}</span>
        )}
        {version.discount > 0 && (
          <span style={{ color: 'var(--color-neutral-600)' }}>Desconto: -{formatCurrency(version.discount)}</span>
        )}
        <strong>Total: {formatCurrency(version.total)}</strong>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `client/src/features/quotes/index.ts`** to export all components:

```typescript
export * from './types'
export * from './api'
export * from './hooks'
export * from './statusLabels'
export { QuotesListPage } from './QuotesListPage'
export { QuoteFormPage } from './QuoteFormPage'
export { QuoteDetailPage } from './QuoteDetailPage'
export { QuoteVersionFormPage } from './QuoteVersionFormPage'
export { AcceptQuoteModal } from './AcceptQuoteModal'
```

- [ ] **Step 4: Verify build**

```bash
cd C:/freela/constru-manager/client && npm run build 2>&1 | tail -20
```

Expected: build succeeds with zero TypeScript errors. If there are errors, fix them before committing.

- [ ] **Step 5: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/AcceptQuoteModal.tsx client/src/features/quotes/QuoteDetailPage.tsx client/src/features/quotes/index.ts
git commit -m "feat(quotes-ui): add AcceptQuoteModal and status actions to QuoteDetailPage"
```

---

## Self-Review

**Spec coverage check:**
- List quotes with status, client, total: ✅ QuotesListPage
- Create new quote with items (product or kit): ✅ QuoteFormPage
- View quote detail (versions, sale info): ✅ QuoteDetailPage
- Add revision (prefilled from active): ✅ QuoteVersionFormPage
- Status update (ADMIN): ✅ Task 6 in QuoteDetailPage
- Accept flow (ADMIN, paymentType, installments): ✅ AcceptQuoteModal in Task 6
- Nav link visible for ADMIN + SALES: ✅ AppLayout Task 2
- Routes wired: ✅ 4 routes in Task 2

**Placeholder scan:** No TBD, no "similar to", no "add appropriate error handling" — all code blocks are complete.

**Type consistency check:**
- `QuoteItemPayload` used in `CreateQuotePayload`, `AddVersionPayload`, and QuoteFormPage/QuoteVersionFormPage — consistent
- `useUpdateStatus` mutationFn signature `{ id, payload }` matches `updateStatus(id, payload)` in api.ts — consistent
- `AcceptQuoteModal` receives `quoteId: string` and calls `useAcceptQuote` with `{ id: quoteId, payload }` — consistent
- `VersionCard` receives `QuoteVersion` from `quote.versions[]` which is typed as `QuoteVersion[]` — consistent
