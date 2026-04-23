import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateClientInput, UpdateClientInput } from './clients.types';

export function listClients(organizationId: string) {
  return prisma.client.findMany({
    where: { isActive: true, organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export function getClientById(id: string, organizationId: string) {
  return prisma.client.findFirst({ where: { id, isActive: true, organizationId } });
}

export function createClient(data: CreateClientInput & { organizationId: string }) {
  return prisma.client.create({ data });
}

export async function updateClient(id: string, organizationId: string, data: UpdateClientInput) {
  try {
    return await prisma.client.update({ where: { id, organizationId }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return null;
    throw err;
  }
}

export async function softDeleteClient(id: string, organizationId: string): Promise<boolean> {
  try {
    await prisma.client.update({ where: { id, organizationId }, data: { isActive: false } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return false;
    throw err;
  }
}
