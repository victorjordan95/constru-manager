import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateProductInput, UpdateProductInput } from './products.types';

export function computeFinalPrice(basePrice: number, markupPercent: number): number {
  return Math.round(basePrice * (1 + markupPercent / 100));
}

export function listProducts(organizationId: string) {
  return prisma.product.findMany({ where: { isActive: true, organizationId }, orderBy: { name: 'asc' } });
}

export function getProduct(id: string, organizationId: string) {
  return prisma.product.findFirst({ where: { id, isActive: true, organizationId } });
}

export function createProduct(data: CreateProductInput & { organizationId: string }) {
  const finalPrice = computeFinalPrice(data.basePrice, data.markupPercent);
  return prisma.product.create({
    data: {
      name: data.name,
      basePrice: data.basePrice,
      markupPercent: data.markupPercent,
      finalPrice,
      unit: data.unit,
      minStock: data.minStock,
      stockQty: data.stockQty ?? 0,
      organizationId: data.organizationId,
    },
  });
}

export async function updateProduct(id: string, organizationId: string, data: UpdateProductInput) {
  const current = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!current) return null;

  const basePrice = data.basePrice ?? current.basePrice;
  const markupPercent = data.markupPercent !== undefined ? data.markupPercent : current.markupPercent.toNumber();
  const finalPrice = computeFinalPrice(basePrice, markupPercent);

  try {
    return await prisma.product.update({ where: { id }, data: { ...data, markupPercent, finalPrice } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return null;
    throw err;
  }
}

export async function softDeleteProduct(id: string, organizationId: string): Promise<boolean> {
  try {
    await prisma.product.update({ where: { id, organizationId }, data: { isActive: false } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return false;
    throw err;
  }
}
