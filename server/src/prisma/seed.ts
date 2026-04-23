import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  console.log('Seeding...');

  // SUPER_ADMIN (no org)
  const superHash = await bcrypt.hash('super123', SALT_ROUNDS);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'super@constru.dev' },
    update: {},
    create: { email: 'super@constru.dev', passwordHash: superHash, role: 'SUPER_ADMIN', isActive: true },
  });

  // Demo organization
  const org = await prisma.organization.upsert({
    where: { id: 'cldefaultorg0000000000000' },
    update: {},
    create: { id: 'cldefaultorg0000000000000', name: 'Constru Demo', isActive: true },
  });

  // Demo users in org
  const adminHash   = await bcrypt.hash('admin123',   SALT_ROUNDS);
  const salesHash   = await bcrypt.hash('sales123',   SALT_ROUNDS);
  const financeHash = await bcrypt.hash('finance123', SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@constru.dev' },
    update: {},
    create: { email: 'admin@constru.dev', passwordHash: adminHash, role: 'ADMIN', isActive: true, organizationId: org.id },
  });

  await prisma.user.upsert({
    where: { email: 'vendas@constru.dev' },
    update: {},
    create: { email: 'vendas@constru.dev', passwordHash: salesHash, role: 'SALES', isActive: true, organizationId: org.id },
  });

  await prisma.user.upsert({
    where: { email: 'financeiro@constru.dev' },
    update: {},
    create: { email: 'financeiro@constru.dev', passwordHash: financeHash, role: 'FINANCE', isActive: true, organizationId: org.id },
  });

  console.log(`✓ SUPER_ADMIN → ${superAdmin.email} (senha: super123)`);
  console.log(`✓ Org Demo    → ${org.name} (id: ${org.id})`);
  console.log(`✓ ADMIN       → ${admin.email} (senha: admin123)`);
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
