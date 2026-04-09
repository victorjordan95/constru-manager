import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateClientInput, UpdateClientInput } from './clients.types';

export function listClients() {
  return prisma.client.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function getClientById(id: string) {
  return prisma.client.findFirst({ where: { id, isActive: true } });
}

export function createClient(data: CreateClientInput) {
  return prisma.client.create({ data });
}

export async function updateClient(id: string, data: UpdateClientInput) {
  try {
    return await prisma.client.update({ where: { id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return null;
    }
    throw err;
  }
}

export async function softDeleteClient(id: string): Promise<boolean> {
  try {
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return false;
    }
    throw err;
  }
}
