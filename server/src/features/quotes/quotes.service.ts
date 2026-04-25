import { prisma } from '../../lib/prisma'
import {
  CreateQuoteInput,
  AddVersionInput,
  UpdateStatusInput,
  AcceptQuoteInput,
} from './quotes.types'

export type StockWarning = {
  productId: string
  productName: string
  stockQty: number
  minStock: number | null
}

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

export async function createQuote(data: CreateQuoteInput & { organizationId: string }) {
  const client = await prisma.client.findFirst({ where: { id: data.clientId, isActive: true, organizationId: data.organizationId } })
  if (!client) return { error: 'CLIENT_NOT_FOUND' as const }

  const productIds = data.items.filter((i) => i.productId).map((i) => i.productId!)
  const kitIds = data.items.filter((i) => i.kitId).map((i) => i.kitId!)

  const [products, kits] = await Promise.all([
    productIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true, organizationId: data.organizationId },
          select: { id: true, finalPrice: true },
        })
      : Promise.resolve([]),
    kitIds.length > 0
      ? prisma.kit.findMany({
          where: { id: { in: kitIds }, isActive: true, organizationId: data.organizationId },
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
    const newQuote = await tx.quote.create({ data: { clientId: data.clientId, organizationId: data.organizationId } })
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

export async function listQuotes(organizationId: string) {
  return prisma.quote.findMany({
    where: { organizationId },
    include: quoteListInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getQuote(id: string, organizationId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, organizationId },
    include: quoteDetailInclude,
  })
  if (!quote) return { error: 'NOT_FOUND' as const }
  return { quote }
}

export async function addVersion(id: string, organizationId: string, data: AddVersionInput) {
  const existing = await prisma.quote.findFirst({
    where: { id, organizationId },
    include: { versions: { select: { version: true }, orderBy: { version: 'desc' } } },
  })
  if (!existing) return { error: 'NOT_FOUND' as const }

  const productIds = data.items.filter((i) => i.productId).map((i) => i.productId!)
  const kitIds = data.items.filter((i) => i.kitId).map((i) => i.kitId!)

  const [products, kits] = await Promise.all([
    productIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true, organizationId },
          select: { id: true, finalPrice: true },
        })
      : Promise.resolve([]),
    kitIds.length > 0
      ? prisma.kit.findMany({
          where: { id: { in: kitIds }, isActive: true, organizationId },
          select: { id: true, totalPrice: true },
        })
      : Promise.resolve([]),
  ])

  const productPriceMap = new Map(products.map((p) => [p.id, p.finalPrice]))
  const kitPriceMap = new Map(
    (kits as { id: string; totalPrice: number }[]).map((k) => [k.id, k.totalPrice]),
  )

  const missingProductIds = productIds.filter((pid) => !productPriceMap.has(pid))
  const missingKitIds = kitIds.filter((kid) => !kitPriceMap.has(kid))
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

  const nextVersion = (existing.versions[0]?.version ?? 0) + 1

  const quote = await prisma.$transaction(async (tx) => {
    const version = await tx.quoteVersion.create({
      data: {
        quoteId: id,
        version: nextVersion,
        subtotal,
        laborCost: data.laborCost,
        discount: data.discount,
        total,
        items: { create: itemsWithPrices },
      },
    })
    return tx.quote.update({
      where: { id },
      data: { activeVersionId: version.id },
      include: quoteDetailInclude,
    })
  })

  return { quote }
}

export async function updateStatus(id: string, organizationId: string, data: UpdateStatusInput) {
  const existing = await prisma.quote.findFirst({ where: { id, organizationId } })
  if (!existing) return { error: 'NOT_FOUND' as const }

  const quote = await prisma.quote.update({
    where: { id },
    data: { status: data.status },
    include: quoteDetailInclude,
  })
  return { quote }
}

export async function duplicateQuote(id: string, organizationId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id, organizationId },
    include: { activeVersion: { include: { items: true } } },
  })
  if (!quote) return { error: 'NOT_FOUND' as const }
  if (!quote.activeVersion) return { error: 'NO_ACTIVE_VERSION' as const }

  const sourceVersion = quote.activeVersion

  const newQuote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({ data: { clientId: quote.clientId, organizationId } })
    const version = await tx.quoteVersion.create({
      data: {
        quoteId: created.id,
        version: 1,
        subtotal: sourceVersion.subtotal,
        laborCost: sourceVersion.laborCost,
        discount: sourceVersion.discount,
        total: sourceVersion.total,
        items: {
          create: sourceVersion.items.map((item) => ({
            productId: item.productId,
            kitId: item.kitId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
    })
    return tx.quote.update({
      where: { id: created.id },
      data: { activeVersionId: version.id },
    })
  })

  return { id: newQuote.id }
}

export async function acceptQuote(id: string, organizationId: string, data: AcceptQuoteInput) {
  const quote = await prisma.quote.findFirst({
    where: { id, organizationId },
    include: {
      activeVersion: {
        include: {
          items: {
            include: {
              kit: { include: { items: { include: { product: { select: { id: true, name: true } } } } } },
              product: { select: { id: true, name: true } },
            },
          },
        },
      },
      sale: true,
    },
  })
  if (!quote) return { error: 'NOT_FOUND' as const }
  if (quote.status === 'ACCEPTED') return { error: 'ALREADY_ACCEPTED' as const }
  if (!quote.activeVersion) return { error: 'NO_ACTIVE_VERSION' as const }

  const total = quote.activeVersion.total

  // Build map of productId → { qty, name } across all items (direct + kit-expanded)
  const productQtyMap = new Map<string, { qty: number; name: string }>()
  for (const item of quote.activeVersion.items) {
    if (item.productId && item.product) {
      const prev = productQtyMap.get(item.productId)
      productQtyMap.set(item.productId, {
        qty: (prev?.qty ?? 0) + item.quantity,
        name: item.product.name,
      })
    } else if (item.kitId && item.kit) {
      for (const kitItem of item.kit.items) {
        const prev = productQtyMap.get(kitItem.productId)
        productQtyMap.set(kitItem.productId, {
          qty: (prev?.qty ?? 0) + kitItem.quantity * item.quantity,
          name: kitItem.product?.name ?? kitItem.productId,
        })
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.sale.create({
      data: {
        quoteId: id,
        paymentType: data.paymentType,
        downPayment: data.downPayment,
        total,
        ...(data.installments && data.installments.length > 0
          ? {
              installments: {
                create: data.installments.map((inst) => ({
                  dueDate: new Date(inst.dueDate),
                  amount: inst.amount,
                })),
              },
            }
          : {}),
      },
    })
    await tx.quote.update({ where: { id }, data: { status: 'ACCEPTED' } })

    for (const [productId, { qty }] of productQtyMap) {
      await tx.product.update({
        where: { id: productId },
        data: { stockQty: { decrement: qty } },
      })
      await tx.stockMovement.create({
        data: {
          productId,
          type: 'OUTFLOW',
          quantity: qty,
          reason: `Aprovação do orçamento ${id}`,
        },
      })
    }
  })

  const updatedQuote = await prisma.quote.findUnique({
    where: { id },
    include: quoteDetailInclude,
  })

  const stockWarnings: StockWarning[] = []
  if (productQtyMap.size > 0) {
    const updatedProducts = await prisma.product.findMany({
      where: { id: { in: [...productQtyMap.keys()] } },
      select: { id: true, name: true, stockQty: true, minStock: true },
    })
    for (const p of updatedProducts) {
      if (p.stockQty < 0 || (p.minStock !== null && p.stockQty < p.minStock)) {
        stockWarnings.push({
          productId: p.id,
          productName: p.name,
          stockQty: p.stockQty,
          minStock: p.minStock,
        })
      }
    }
  }

  return { quote: updatedQuote, stockWarnings }
}
