import { prisma } from '../../lib/prisma';
import { hashPassword } from '../auth/auth.service';

export function listOrganizations() {
  return prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
}

export function createOrganization(name: string) {
  return prisma.organization.create({ data: { name } });
}

export async function updateOrganization(id: string, data: { name?: string; isActive?: boolean }) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return null;
  return prisma.organization.update({ where: { id }, data });
}

export async function createAdminForOrg(organizationId: string, email: string, password: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return { error: 'ORG_NOT_FOUND' as const };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'EMAIL_TAKEN' as const };

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: 'ADMIN', organizationId, isActive: true },
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });
  return { user };
}

export async function getCurrentOrg(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, logoUrl: true },
  });
}

export async function updateOrgLogoUrl(id: string, logoUrl: string) {
  return prisma.organization.update({ where: { id }, data: { logoUrl } });
}
