import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateFixedExpenseInput, UpdateFixedExpenseInput } from './fixed-expenses.types';

export function listFixedExpenses(organizationId: string) {
  return prisma.fixedExpense.findMany({ where: { isActive: true, organizationId }, orderBy: { name: 'asc' } });
}

export function getFixedExpense(id: string, organizationId: string) {
  return prisma.fixedExpense.findFirst({ where: { id, isActive: true, organizationId } });
}

export function createFixedExpense(data: CreateFixedExpenseInput & { organizationId: string }) {
  return prisma.fixedExpense.create({
    data: {
      name: data.name,
      amount: data.amount,
      dueDay: data.dueDay,
      category: data.category ?? null,
      organizationId: data.organizationId,
    },
  });
}

export async function updateFixedExpense(id: string, organizationId: string, data: UpdateFixedExpenseInput) {
  try {
    return await prisma.fixedExpense.update({
      where: { id, isActive: true, organizationId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.dueDay !== undefined && { dueDay: data.dueDay }),
        ...(data.category !== undefined && { category: data.category }),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return null;
    throw err;
  }
}

export async function softDeleteFixedExpense(id: string, organizationId: string): Promise<boolean> {
  try {
    await prisma.fixedExpense.update({ where: { id, isActive: true, organizationId }, data: { isActive: false } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return false;
    throw err;
  }
}
