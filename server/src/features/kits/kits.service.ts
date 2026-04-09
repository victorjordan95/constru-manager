import { prisma } from '../../lib/prisma';
import { CreateKitInput, KitItemInput, UpdateKitInput } from './kits.types';

export function computeKitTotalPriceFromMap(
  items: KitItemInput[],
  priceMap: Map<string, number>,
): number {
  return items.reduce((sum, item) => sum + (priceMap.get(item.productId) ?? 0) * item.quantity, 0);
}

// Shared include shape for all kit responses
const kitInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, finalPrice: true, unit: true } },
    },
  },
} as const;

async function buildPriceMap(productIds: string[]): Promise<Map<string, number>> {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, finalPrice: true },
  });
  return new Map(products.map(p => [p.id, p.finalPrice]));
}

export function listKits() {
  return prisma.kit.findMany({
    where: { isActive: true },
    include: kitInclude,
    orderBy: { name: 'asc' },
  });
}

export async function createKit(data: CreateKitInput) {
  const productIds = data.items.map(i => i.productId);
  const priceMap = await buildPriceMap(productIds);

  const missingIds = productIds.filter(id => !priceMap.has(id));
  if (missingIds.length > 0) {
    return { error: 'INVALID_PRODUCT' as const, ids: missingIds };
  }

  const totalPrice = computeKitTotalPriceFromMap(data.items, priceMap);

  const kit = await prisma.kit.create({
    data: {
      name: data.name,
      totalPrice,
      items: {
        create: data.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      },
    },
    include: kitInclude,
  });

  return { kit };
}

export async function updateKit(id: string, data: UpdateKitInput) {
  const existing = await prisma.kit.findFirst({ where: { id, isActive: true } });
  if (!existing) return { error: 'NOT_FOUND' as const };

  if (data.items) {
    const productIds = data.items.map(i => i.productId);
    const priceMap = await buildPriceMap(productIds);
    const missingIds = productIds.filter(pid => !priceMap.has(pid));
    if (missingIds.length > 0) {
      return { error: 'INVALID_PRODUCT' as const, ids: missingIds };
    }

    const totalPrice = computeKitTotalPriceFromMap(data.items, priceMap);
    const newItems = data.items;

    await prisma.$transaction(async tx => {
      await tx.kitItem.deleteMany({ where: { kitId: id } });
      await tx.kit.update({
        where: { id },
        data: {
          name: data.name ?? existing.name,
          totalPrice,
          items: {
            create: newItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
          },
        },
      });
    });
  } else if (data.name) {
    await prisma.kit.update({ where: { id }, data: { name: data.name } });
  }

  const kit = await prisma.kit.findUnique({ where: { id }, include: kitInclude });
  return { kit };
}
