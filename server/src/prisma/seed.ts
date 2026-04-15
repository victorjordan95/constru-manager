import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('Seeding users...');

  const adminHash   = await bcrypt.hash('admin123',    SALT_ROUNDS);
  const salesHash   = await bcrypt.hash('sales123',    SALT_ROUNDS);
  const financeHash = await bcrypt.hash('finance123',  SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@constru.dev' },
    update: {},
    create: { email: 'admin@constru.dev', passwordHash: adminHash, role: 'ADMIN', isActive: true },
  });

  const sales = await prisma.user.upsert({
    where: { email: 'vendas@constru.dev' },
    update: {},
    create: { email: 'vendas@constru.dev', passwordHash: salesHash, role: 'SALES', isActive: true },
  });

  const finance = await prisma.user.upsert({
    where: { email: 'financeiro@constru.dev' },
    update: {},
    create: { email: 'financeiro@constru.dev', passwordHash: financeHash, role: 'FINANCE', isActive: true },
  });

  console.log(`✓ ADMIN   → ${admin.email}   (senha: admin123)`);
  console.log(`✓ SALES   → ${sales.email}  (senha: sales123)`);
  console.log(`✓ FINANCE → ${finance.email} (senha: finance123)`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
