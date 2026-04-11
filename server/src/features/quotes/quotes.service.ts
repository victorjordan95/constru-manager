import { prisma } from '../../lib/prisma'
import {
  CreateQuoteInput,
  AddVersionInput,
  UpdateStatusInput,
  AcceptQuoteInput,
} from './quotes.types'

// ─── Pure helper ──────────────────────────────────────────────────────────────

export function computeVersionTotals(
  lineTotals: number[],
  laborCost: number,
  discount: number,
): { subtotal: number; total: number } {
  const subtotal = lineTotals.reduce((s, t) => s + t, 0)
  return { subtotal, total: subtotal + laborCost - discount }
}

// ─── Shared Prisma includes ────────────────────────────────────────────────────

const quoteItemInclude = {
  product: { select: { id: true, name: true, unit: true } },
  kit: { select: { id: true, name: true } },
} as const

const quoteVersionInclude = {
  items: { include: quoteItemInclude },
} as const

// Used by getQuote — full detail
const quoteDetailInclude = {
  client: { select: { id: true, name: true } },
  activeVersion: { include: quoteVersionInclude },
  versions: {
    include: quoteVersionInclude,
    orderBy: { version: 'asc' as const },
  },
  sale: {
    include: {
      installments: { orderBy: { dueDate: 'asc' as const } },
    },
  },
} as const

// Used by listQuotes — lightweight summary
const quoteListInclude = {
  client: { select: { id: true, name: true } },
  activeVersion: {
    select: {
      id: true,
      version: true,
      subtotal: true,
      laborCost: true,
      discount: true,
      total: true,
      createdAt: true,
    },
  },
} as const

// Service functions are added in Tasks 3-7.
// These type references suppress "declared but never read" errors until then.
type _Unused = CreateQuoteInput | AddVersionInput | UpdateStatusInput | AcceptQuoteInput
void prisma
