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
