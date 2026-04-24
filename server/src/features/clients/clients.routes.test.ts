import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { hashPassword, signAccessToken } from '../auth/auth.service';

const UNIQUE = `p3-clients-${Date.now()}`;
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`;
const SALES_EMAIL = `${UNIQUE}-sales@test.com`;
const FINANCE_EMAIL = `${UNIQUE}-finance@test.com`;

let adminToken: string;
let salesToken: string;
let financeToken: string;
let testOrgId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Org ${UNIQUE}` } });
  testOrgId = org.id;
  const pw = await hashPassword('TestPass123!');
  await prisma.user.createMany({
    data: [
      { email: ADMIN_EMAIL, passwordHash: pw, role: 'ADMIN', organizationId: testOrgId },
      { email: SALES_EMAIL, passwordHash: pw, role: 'SALES', organizationId: testOrgId },
      { email: FINANCE_EMAIL, passwordHash: pw, role: 'FINANCE', organizationId: testOrgId },
    ],
  });
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, SALES_EMAIL, FINANCE_EMAIL] } },
    select: { id: true, email: true, role: true },
  });
  const byEmail = Object.fromEntries(users.map(u => [u.email, u]));
  adminToken = signAccessToken({ userId: byEmail[ADMIN_EMAIL].id, role: byEmail[ADMIN_EMAIL].role, organizationId: testOrgId });
  salesToken = signAccessToken({ userId: byEmail[SALES_EMAIL].id, role: byEmail[SALES_EMAIL].role, organizationId: testOrgId });
  financeToken = signAccessToken({ userId: byEmail[FINANCE_EMAIL].id, role: byEmail[FINANCE_EMAIL].role, organizationId: testOrgId });
});

afterAll(async () => {
  await prisma.client.deleteMany({ where: { taxId: { startsWith: UNIQUE } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: `Org ${UNIQUE}` } } });
  await prisma.$disconnect();
});

// ─── GET /clients ─────────────────────────────────────────────────────────────

describe('GET /clients', () => {
  it('returns 200 with array for ADMIN', async () => {
    const res = await request(app)
      .get('/clients')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 200 with array for SALES', async () => {
    const res = await request(app)
      .get('/clients')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for FINANCE', async () => {
    const res = await request(app)
      .get('/clients')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/clients');
    expect(res.status).toBe(401);
  });
});

// ─── POST /clients ────────────────────────────────────────────────────────────

describe('POST /clients', () => {
  it('creates a client and returns 201 with isActive true', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Acme Corp', taxId: `${UNIQUE}-001` });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Acme Corp');
    expect(res.body.taxId).toBe(`${UNIQUE}-001`);
    expect(res.body.isActive).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('returns 201 for SALES role', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: 'Sales Client', taxId: `${UNIQUE}-sales-001` });
    expect(res.status).toBe(201);
  });

  it('returns 400 VALIDATION_ERROR on missing name', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ taxId: `${UNIQUE}-002` });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 DUPLICATE_TAX_ID on duplicate taxId', async () => {
    await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'First', taxId: `${UNIQUE}-dupe` });
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Second', taxId: `${UNIQUE}-dupe` });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_TAX_ID');
  });

  it('returns 403 for FINANCE', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ name: 'X', taxId: `${UNIQUE}-fin` });
    expect(res.status).toBe(403);
  });
});

// ─── GET /clients/:id ─────────────────────────────────────────────────────────

describe('GET /clients/:id', () => {
  let clientId: string;

  beforeAll(async () => {
    const c = await prisma.client.create({ data: { name: 'Lookup Corp', taxId: `${UNIQUE}-get`, organizationId: testOrgId } });
    clientId = c.id;
  });

  it('returns 200 with client data', async () => {
    const res = await request(app)
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(clientId);
    expect(res.body.name).toBe('Lookup Corp');
  });

  it('returns 404 NOT_FOUND for unknown id', async () => {
    const res = await request(app)
      .get('/clients/nonexistent-id-xyz')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

// ─── PUT /clients/:id ─────────────────────────────────────────────────────────

describe('PUT /clients/:id', () => {
  let clientId: string;

  beforeAll(async () => {
    const c = await prisma.client.create({ data: { name: 'Old Name', taxId: `${UNIQUE}-put`, organizationId: testOrgId } });
    clientId = c.id;
  });

  it('returns 200 with updated client', async () => {
    const res = await request(app)
      .put(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('returns 404 on unknown id', async () => {
    const res = await request(app)
      .put('/clients/nonexistent-xyz')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns 403 for FINANCE', async () => {
    const res = await request(app)
      .put(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});

// ─── DELETE /clients/:id ──────────────────────────────────────────────────────

describe('DELETE /clients/:id', () => {
  let clientId: string;

  beforeAll(async () => {
    const c = await prisma.client.create({ data: { name: 'To Delete', taxId: `${UNIQUE}-del`, organizationId: testOrgId } });
    clientId = c.id;
  });

  it('returns 204 and soft-deletes (GET returns 404 after)', async () => {
    const res = await request(app)
      .delete(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const check = await request(app)
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(check.status).toBe(404);
  });

  it('returns 403 for SALES role', async () => {
    const c = await prisma.client.create({ data: { name: 'Protected', taxId: `${UNIQUE}-del2`, organizationId: testOrgId } });
    const res = await request(app)
      .delete(`/clients/${c.id}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });
});
