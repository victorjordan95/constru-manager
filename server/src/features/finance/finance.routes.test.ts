import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { hashPassword, signAccessToken } from '../auth/auth.service';

const UNIQUE = `p5-finance-${Date.now()}`;
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`;
const FINANCE_EMAIL = `${UNIQUE}-finance@test.com`;
const SALES_EMAIL = `${UNIQUE}-sales@test.com`;

let adminToken: string;
let financeToken: string;
let salesToken: string;
let installmentId: string;
let expenseLogId: string;
let fixedExpenseId: string;
let testOrgId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Org ${UNIQUE}` } });
  testOrgId = org.id;
  const pw = await hashPassword('TestPass123!');
  await prisma.user.createMany({
    data: [
      { email: ADMIN_EMAIL, passwordHash: pw, role: 'ADMIN', organizationId: testOrgId },
      { email: FINANCE_EMAIL, passwordHash: pw, role: 'FINANCE', organizationId: testOrgId },
      { email: SALES_EMAIL, passwordHash: pw, role: 'SALES', organizationId: testOrgId },
    ],
  });
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, FINANCE_EMAIL, SALES_EMAIL] } },
    select: { id: true, email: true, role: true },
  });
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  adminToken = signAccessToken({ userId: byEmail[ADMIN_EMAIL].id, role: byEmail[ADMIN_EMAIL].role, organizationId: testOrgId });
  financeToken = signAccessToken({ userId: byEmail[FINANCE_EMAIL].id, role: byEmail[FINANCE_EMAIL].role, organizationId: testOrgId });
  salesToken = signAccessToken({ userId: byEmail[SALES_EMAIL].id, role: byEmail[SALES_EMAIL].role, organizationId: testOrgId });

  // Create a client, product, quote, sale, and installment for pay tests
  const client = await prisma.client.create({ data: { name: `${UNIQUE} Client`, taxId: `FIN${Date.now()}`, organizationId: testOrgId } });
  const product = await prisma.product.create({
    data: { name: `${UNIQUE} Prod`, basePrice: 10000, markupPercent: 20, finalPrice: 12000, stockQty: 0, organizationId: testOrgId },
  });
  const quote = await prisma.quote.create({ data: { clientId: client.id, organizationId: testOrgId } });
  const version = await prisma.quoteVersion.create({
    data: {
      quoteId: quote.id, version: 1, subtotal: 12000, laborCost: 0, discount: 0, total: 12000,
      items: { create: [{ productId: product.id, quantity: 1, unitPrice: 12000, lineTotal: 12000 }] },
    },
  });
  await prisma.quote.update({ where: { id: quote.id }, data: { activeVersionId: version.id, status: 'ACCEPTED' } });
  const sale = await prisma.sale.create({
    data: { quoteId: quote.id, paymentType: 'INSTALLMENTS', downPayment: 0, total: 12000 },
  });
  const installment = await prisma.installment.create({
    data: { saleId: sale.id, dueDate: new Date(), amount: 12000 },
  });
  installmentId = installment.id;

  // Create a fixed expense and its log for pay tests
  const expense = await prisma.fixedExpense.create({
    data: { name: `${UNIQUE} Conta Luz`, amount: 30000, dueDay: 10, organizationId: testOrgId },
  });
  fixedExpenseId = expense.id;
  const now = new Date();
  const log = await prisma.fixedExpenseLog.create({
    data: { fixedExpenseId: expense.id, month: now.getMonth() + 1, year: now.getFullYear() },
  });
  expenseLogId = log.id;
});

afterAll(async () => {
  // Clean up transactions first
  await prisma.cashTransaction.deleteMany({
    where: { OR: [{ installmentId }, { fixedExpenseLogId: expenseLogId }] },
  });

  // Clean up installment
  const inst = await prisma.installment.findUnique({ where: { id: installmentId }, select: { saleId: true } });
  if (inst) {
    await prisma.installment.deleteMany({ where: { saleId: inst.saleId } });
    await prisma.sale.delete({ where: { id: inst.saleId } });
  }

  // Clean up quote chain
  const clientRecord = await prisma.client.findFirst({ where: { name: `${UNIQUE} Client` }, select: { id: true } });
  if (clientRecord) {
    const quotes = await prisma.quote.findMany({ where: { clientId: clientRecord.id }, select: { id: true } });
    const qIds = quotes.map((q) => q.id);
    const versions = await prisma.quoteVersion.findMany({ where: { quoteId: { in: qIds } }, select: { id: true } });
    await prisma.quoteItem.deleteMany({ where: { quoteVersionId: { in: versions.map((v) => v.id) } } });
    await prisma.quote.updateMany({ where: { id: { in: qIds } }, data: { activeVersionId: null } });
    await prisma.quoteVersion.deleteMany({ where: { quoteId: { in: qIds } } });
    await prisma.quote.deleteMany({ where: { id: { in: qIds } } });
    await prisma.client.delete({ where: { id: clientRecord.id } });
  }

  // Clean up product
  await prisma.product.deleteMany({ where: { name: { startsWith: UNIQUE } } });

  // Clean up fixed expense (log first due to FK)
  await prisma.fixedExpenseLog.deleteMany({ where: { fixedExpenseId } });
  await prisma.fixedExpense.delete({ where: { id: fixedExpenseId } });

  // Clean up finance settings
  await prisma.financeSettings.deleteMany({ where: { organizationId: testOrgId } });

  // Clean up users
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: `Org ${UNIQUE}` } } });

  await prisma.$disconnect();
});

// ─── GET /finance/balance ─────────────────────────────────────────────────────

describe('GET /finance/balance', () => {
  it('returns openingBalance 0 when no settings exist (ADMIN)', async () => {
    const res = await request(app).get('/finance/balance').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.openingBalance).toBe(0);
  });

  it('returns 403 for SALES', async () => {
    const res = await request(app).get('/finance/balance').set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/finance/balance');
    expect(res.status).toBe(401);
  });
});

// ─── PUT /finance/balance ─────────────────────────────────────────────────────

describe('PUT /finance/balance', () => {
  it('sets openingBalance (FINANCE)', async () => {
    const res = await request(app)
      .put('/finance/balance')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ openingBalance: 100000 });
    expect(res.status).toBe(200);
    expect(res.body.openingBalance).toBe(100000);
  });

  it('returns 400 VALIDATION_ERROR for negative amount', async () => {
    const res = await request(app)
      .put('/finance/balance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openingBalance: -1 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET /finance/summary ─────────────────────────────────────────────────────

describe('GET /finance/summary', () => {
  it('returns summary with balance, projected, installments, expenseLogs (ADMIN)', async () => {
    const now = new Date();
    const res = await request(app)
      .get(`/finance/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.balance).toBe('number');
    expect(typeof res.body.projected.incoming).toBe('number');
    expect(typeof res.body.projected.outgoing).toBe('number');
    expect(typeof res.body.realized.netProfit).toBe('number');
    expect(Array.isArray(res.body.installments)).toBe(true);
    expect(Array.isArray(res.body.expenseLogs)).toBe(true);
  });

  it('auto-creates FixedExpenseLog for active expenses in the month (idempotent)', async () => {
    const now = new Date();
    const params = `month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
    await request(app).get(`/finance/summary?${params}`).set('Authorization', `Bearer ${adminToken}`);
    await request(app).get(`/finance/summary?${params}`).set('Authorization', `Bearer ${adminToken}`);
    const logs = await prisma.fixedExpenseLog.findMany({
      where: { fixedExpenseId, month: now.getMonth() + 1, year: now.getFullYear() },
    });
    expect(logs).toHaveLength(1); // idempotent — no duplicates
  });

  it('returns 400 VALIDATION_ERROR for missing month', async () => {
    const res = await request(app)
      .get('/finance/summary?year=2026')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .get('/finance/summary?month=1&year=2026')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /finance/installments/:id/pay ─────────────────────────────────────

describe('PATCH /finance/installments/:id/pay', () => {
  it('marks installment as PAID and creates CashTransaction (ADMIN)', async () => {
    const res = await request(app)
      .patch(`/finance/installments/${installmentId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    expect(res.body.paidAt).toBeTruthy();
    const tx = await prisma.cashTransaction.findFirst({ where: { installmentId } });
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('INCOME');
    expect(tx!.amount).toBe(12000);
  });

  it('returns 400 ALREADY_PAID for already paid installment', async () => {
    const res = await request(app)
      .patch(`/finance/installments/${installmentId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_PAID');
  });

  it('returns 404 for unknown installment', async () => {
    const res = await request(app)
      .patch('/finance/installments/nonexistent/pay')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /finance/expense-logs/:id/pay ─────────────────────────────────────

describe('PATCH /finance/expense-logs/:id/pay', () => {
  it('marks expense log as PAID and creates CashTransaction (FINANCE)', async () => {
    const res = await request(app)
      .patch(`/finance/expense-logs/${expenseLogId}/pay`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    const tx = await prisma.cashTransaction.findFirst({ where: { fixedExpenseLogId: expenseLogId } });
    expect(tx).not.toBeNull();
    expect(tx!.type).toBe('EXPENSE');
    expect(tx!.amount).toBe(30000);
  });

  it('returns 400 ALREADY_PAID for already paid log', async () => {
    const res = await request(app)
      .patch(`/finance/expense-logs/${expenseLogId}/pay`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ALREADY_PAID');
  });

  it('returns 404 for unknown expense log', async () => {
    const res = await request(app)
      .patch('/finance/expense-logs/nonexistent/pay')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
