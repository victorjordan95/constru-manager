import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateKitInput, KitItemInput, UpdateKitInput } from './kits.types';

export function computeKitTotalPriceFromMap(
  items: KitItemInput[],
  priceMap: Map<string, number>,
): number {
  return items.reduce((sum, item) => sum + (priceMap.get(item.productId) ?? 0) * item.quantity, 0);
}

const kitInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, finalPrice: true, unit: true } },
    },
  },
} as const;

async function buildPriceMap(productIds: string[], organizationId: string): Promise<Map<string, number>> {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true, organizationId },
    select: { id: true, finalPrice: true },
  });
  return new Map(products.map(p => [p.id, p.finalPrice]));
}

export function listKits(organizationId: string) {
  return prisma.kit.findMany({
    where: { isActive: true, organizationId },
    include: kitInclude,
    orderBy: { name: 'asc' },
  });
}

export function getKit(id: string, organizationId: string) {
  return prisma.kit.findFirst({ where: { id, isActive: true, organizationId }, include: kitInclude });
}

export async function createKit(data: CreateKitInput & { organizationId: string }) {
  const productIds = data.items.map(i => i.productId);
  const priceMap = await buildPriceMap(productIds, data.organizationId);

  const missingIds = productIds.filter(id => !priceMap.has(id));
  if (missingIds.length > 0) return { error: 'INVALID_PRODUCT' as const, ids: missingIds };

  const totalPrice = computeKitTotalPriceFromMap(data.items, priceMap);
  const kit = await prisma.kit.create({
    data: {
      name: data.name,
      totalPrice,
      organizationId: data.organizationId,
      items: { create: data.items.map(i => ({ productId: i.productId, quantity: i.quantity })) },
    },
    include: kitInclude,
  });
  return { kit };
}

export async function updateKit(id: string, organizationId: string, data: UpdateKitInput) {
  const existing = await prisma.kit.findFirst({ where: { id, isActive: true, organizationId } });
  if (!existing) return { error: 'NOT_FOUND' as const };

  if (data.items) {
    const productIds = data.items.map(i => i.productId);
    const priceMap = await buildPriceMap(productIds, organizationId);
    const missingIds = productIds.filter(pid => !priceMap.has(pid));
    if (missingIds.length > 0) return { error: 'INVALID_PRODUCT' as const, ids: missingIds };

    const totalPrice = computeKitTotalPriceFromMap(data.items, priceMap);
    const newItems = data.items;

    await prisma.$transaction(async tx => {
      await tx.kitItem.deleteMany({ where: { kitId: id } });
      await tx.kit.update({
        where: { id },
        data: {
          name: data.name ?? existing.name,
          totalPrice,
          items: { create: newItems.map(i => ({ productId: i.productId, quantity: i.quantity })) },
        },
      });
    });
  } else if (data.name) {
    await prisma.kit.update({ where: { id }, data: { name: data.name } });
  }

  const kit = await prisma.kit.findUnique({ where: { id }, include: kitInclude });
  return { kit };
}

export async function softDeleteKit(id: string, organizationId: string): Promise<boolean> {
  try {
    await prisma.kit.update({ where: { id, organizationId }, data: { isActive: false } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return false;
    throw err;
  }
}
