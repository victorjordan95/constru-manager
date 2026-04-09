import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { hashPassword, signAccessToken } from '../auth/auth.service';

const UNIQUE = `p3-kits-${Date.now()}`;
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`;
const SALES_EMAIL = `${UNIQUE}-sales@test.com`;

let adminToken: string;
let salesToken: string;
let productAId: string;
let productBId: string;

beforeAll(async () => {
  const pw = await hashPassword('TestPass123!');
  await prisma.user.createMany({
    data: [
      { email: ADMIN_EMAIL, passwordHash: pw, role: 'ADMIN' },
      { email: SALES_EMAIL, passwordHash: pw, role: 'SALES' },
    ],
  });
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, SALES_EMAIL] } },
    select: { id: true, email: true, role: true },
  });
  const byEmail = Object.fromEntries(users.map(u => [u.email, u]));
  adminToken = signAccessToken({ userId: byEmail[ADMIN_EMAIL].id, role: byEmail[ADMIN_EMAIL].role });
  salesToken = signAccessToken({ userId: byEmail[SALES_EMAIL].id, role: byEmail[SALES_EMAIL].role });

  const [pA, pB] = await Promise.all([
    prisma.product.create({
      data: {
        name: `${UNIQUE} ProductA`,
        basePrice: 10000,
        markupPercent: 20,
        finalPrice: 12000,
        stockQty: 0,
      },
    }),
    prisma.product.create({
      data: {
        name: `${UNIQUE} ProductB`,
        basePrice: 5000,
        markupPercent: 0,
        finalPrice: 5000,
        stockQty: 0,
      },
    }),
  ]);
  productAId = pA.id;
  productBId = pB.id;
});

afterAll(async () => {
  const kits = await prisma.kit.findMany({
    where: { name: { startsWith: UNIQUE } },
    select: { id: true },
  });
  const kitIds = kits.map(k => k.id);
  await prisma.kitItem.deleteMany({ where: { kitId: { in: kitIds } } });
  await prisma.kit.deleteMany({ where: { id: { in: kitIds } } });
  await prisma.product.deleteMany({ where: { name: { startsWith: UNIQUE } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
  await prisma.$disconnect();
});

// ─── GET /kits ────────────────────────────────────────────────────────────────

describe('GET /kits', () => {
  it('returns 200 with array for ADMIN', async () => {
    const res = await request(app)
      .get('/kits')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .get('/kits')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/kits');
    expect(res.status).toBe(401);
  });
});

// ─── POST /kits ───────────────────────────────────────────────────────────────

describe('POST /kits', () => {
  it('creates kit with items and auto-computed totalPrice', async () => {
    const res = await request(app)
      .post('/kits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Basic Kit`, items: [{ productId: productAId, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(`${UNIQUE} Basic Kit`);
    expect(res.body.totalPrice).toBe(24000); // 12000 × 2
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(2);
    expect(res.body.items[0].product.id).toBe(productAId);
  });

  it('returns 400 INVALID_PRODUCT for non-existent productId', async () => {
    const res = await request(app)
      .post('/kits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Bad`, items: [{ productId: 'does-not-exist', quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PRODUCT');
  });

  it('returns 400 VALIDATION_ERROR when items is empty array', async () => {
    const res = await request(app)
      .post('/kits')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Empty`, items: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .post('/kits')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: `${UNIQUE} x`, items: [{ productId: productAId, quantity: 1 }] });
    expect(res.status).toBe(403);
  });
});

// ─── PUT /kits/:id ────────────────────────────────────────────────────────────

describe('PUT /kits/:id', () => {
  let kitId: string;

  beforeAll(async () => {
    const kit = await prisma.kit.create({
      data: {
        name: `${UNIQUE} UpdateMe`,
        totalPrice: 12000,
        items: { create: [{ productId: productAId, quantity: 1 }] },
      },
    });
    kitId = kit.id;
  });

  it('updates kit name only', async () => {
    const res = await request(app)
      .put(`/kits/${kitId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Renamed` });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(`${UNIQUE} Renamed`);
  });

  it('replaces all items and recomputes totalPrice', async () => {
    const res = await request(app)
      .put(`/kits/${kitId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId: productBId, quantity: 3 }] });
    expect(res.status).toBe(200);
    expect(res.body.totalPrice).toBe(15000); // 5000 × 3
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product.id).toBe(productBId);
  });

  it('returns 404 NOT_FOUND for unknown kit id', async () => {
    const res = await request(app)
      .put('/kits/nonexistent-xyz')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .put(`/kits/${kitId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});
