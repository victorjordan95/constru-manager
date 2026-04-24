import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { hashPassword, signAccessToken } from '../auth/auth.service';

const UNIQUE = `p3-products-${Date.now()}`;
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`;
const SALES_EMAIL = `${UNIQUE}-sales@test.com`;

let adminToken: string;
let salesToken: string;
let testOrgId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Org ${UNIQUE}` } });
  testOrgId = org.id;
  const pw = await hashPassword('TestPass123!');
  await prisma.user.createMany({
    data: [
      { email: ADMIN_EMAIL, passwordHash: pw, role: 'ADMIN', organizationId: testOrgId },
      { email: SALES_EMAIL, passwordHash: pw, role: 'SALES', organizationId: testOrgId },
    ],
  });
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, SALES_EMAIL] } },
    select: { id: true, email: true, role: true },
  });
  const byEmail = Object.fromEntries(users.map(u => [u.email, u]));
  adminToken = signAccessToken({ userId: byEmail[ADMIN_EMAIL].id, role: byEmail[ADMIN_EMAIL].role, organizationId: testOrgId });
  salesToken = signAccessToken({ userId: byEmail[SALES_EMAIL].id, role: byEmail[SALES_EMAIL].role, organizationId: testOrgId });
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { name: { startsWith: UNIQUE } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: `Org ${UNIQUE}` } } });
  await prisma.$disconnect();
});

// ─── GET /products ────────────────────────────────────────────────────────────

describe('GET /products', () => {
  it('returns 200 with array for ADMIN', async () => {
    const res = await request(app)
      .get('/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 200 for SALES', async () => {
    const res = await request(app)
      .get('/products')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/products');
    expect(res.status).toBe(401);
  });
});

// ─── POST /products ───────────────────────────────────────────────────────────

describe('POST /products', () => {
  it('creates product with auto-computed finalPrice and returns 201', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Widget`, basePrice: 10000, markupPercent: 20 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(`${UNIQUE} Widget`);
    expect(res.body.basePrice).toBe(10000);
    expect(res.body.finalPrice).toBe(12000);
    expect(res.body.stockQty).toBe(0);
    expect(res.body.id).toBeDefined();
  });

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: `${UNIQUE} x`, basePrice: 100, markupPercent: 10 });
    expect(res.status).toBe(403);
  });

  it('returns 400 VALIDATION_ERROR on missing basePrice', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} x`, markupPercent: 10 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR on negative basePrice', async () => {
    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} x`, basePrice: -1, markupPercent: 10 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── PUT /products/:id ────────────────────────────────────────────────────────

describe('PUT /products/:id', () => {
  let productId: string;

  beforeAll(async () => {
    const p = await prisma.product.create({
      data: {
        name: `${UNIQUE} Old`,
        basePrice: 5000,
        markupPercent: 10,
        finalPrice: 5500,
        stockQty: 0,
        organizationId: testOrgId,
      },
    });
    productId = p.id;
  });

  it('updates product and recomputes finalPrice', async () => {
    const res = await request(app)
      .put(`/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ basePrice: 10000, markupPercent: 50 });
    expect(res.status).toBe(200);
    expect(res.body.finalPrice).toBe(15000);
  });

  it('returns 404 NOT_FOUND for unknown id', async () => {
    const res = await request(app)
      .put('/products/nonexistent-xyz')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .put(`/products/${productId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /products/:id ─────────────────────────────────────────────────────

describe('DELETE /products/:id', () => {
  let productId: string;

  beforeAll(async () => {
    const p = await prisma.product.create({
      data: {
        name: `${UNIQUE} ToDelete`,
        basePrice: 100,
        markupPercent: 0,
        finalPrice: 100,
        stockQty: 0,
        organizationId: testOrgId,
      },
    });
    productId = p.id;
  });

  it('soft-deletes product (isActive = false) and returns 204', async () => {
    const res = await request(app)
      .delete(`/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const check = await prisma.product.findUnique({ where: { id: productId } });
    expect(check?.isActive).toBe(false);
  });

  it('returns 403 for SALES', async () => {
    const p = await prisma.product.create({
      data: {
        name: `${UNIQUE} Protected`,
        basePrice: 100,
        markupPercent: 0,
        finalPrice: 100,
        stockQty: 0,
        organizationId: testOrgId,
      },
    });
    const res = await request(app)
      .delete(`/products/${p.id}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });
});
