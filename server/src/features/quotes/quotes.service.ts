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

// ─── Service functions ─────────────────────────────────────────────────────────

export async function createQuote(data: CreateQuoteInput) {
  const client = await prisma.client.findFirst({ where: { id: data.clientId } })
  if (!client) return { error: 'CLIENT_NOT_FOUND' as const }

  const productIds = data.items.filter((i) => i.productId).map((i) => i.productId!)
  const kitIds = data.items.filter((i) => i.kitId).map((i) => i.kitId!)

  const [products, kits] = await Promise.all([
    productIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, finalPrice: true },
        })
      : Promise.resolve([]),
    kitIds.length > 0
      ? prisma.kit.findMany({
          where: { id: { in: kitIds }, isActive: true },
          select: { id: true, totalPrice: true },
        })
      : Promise.resolve([]),
  ])

  const productPriceMap = new Map(products.map((p) => [p.id, p.finalPrice]))
  const kitPriceMap = new Map(
    (kits as { id: string; totalPrice: number }[]).map((k) => [k.id, k.totalPrice]),
  )

  const missingProductIds = productIds.filter((id) => !productPriceMap.has(id))
  const missingKitIds = kitIds.filter((id) => !kitPriceMap.has(id))
  if (missingProductIds.length > 0 || missingKitIds.length > 0) {
    return { error: 'INVALID_ITEM' as const }
  }

  const itemsWithPrices = data.items.map((item) => {
    const unitPrice = item.productId
      ? productPriceMap.get(item.productId)!
      : kitPriceMap.get(item.kitId!)!
    return {
      productId: item.productId ?? null,
      kitId: item.kitId ?? null,
      quantity: item.quantity,
      unitPrice,
      lineTotal: item.quantity * unitPrice,
    }
  })

  const { subtotal, total } = computeVersionTotals(
    itemsWithPrices.map((i) => i.lineTotal),
    data.laborCost,
    data.discount,
  )

  const quote = await prisma.$transaction(async (tx) => {
    const newQuote = await tx.quote.create({ data: { clientId: data.clientId } })
    const version = await tx.quoteVersion.create({
      data: {
        quoteId: newQuote.id,
        version: 1,
        subtotal,
        laborCost: data.laborCost,
        discount: data.discount,
        total,
        items: { create: itemsWithPrices },
      },
    })
    return tx.quote.update({
      where: { id: newQuote.id },
      data: { activeVersionId: version.id },
      include: quoteDetailInclude,
    })
  })

  return { quote }
}

// Stubs — replaced in Tasks 4-7
export async function listQuotes() {
  return prisma.quote.findMany({
    include: quoteListInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getQuote(_id: string): Promise<{ error: 'NOT_FOUND' } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}

export async function addVersion(
  _id: string,
  _data: AddVersionInput,
): Promise<{ error: string } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}

export async function updateStatus(
  _id: string,
  _data: UpdateStatusInput,
): Promise<{ error: 'NOT_FOUND' } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}

export async function acceptQuote(
  _id: string,
  _data: AcceptQuoteInput,
): Promise<{ error: string } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}
