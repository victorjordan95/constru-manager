import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { hashPassword, signAccessToken } from '../auth/auth.service';

// Mock Cloudinary so tests don't require real credentials
jest.mock('../../lib/cloudinary', () => ({
  uploadImageBuffer: jest.fn().mockResolvedValue('https://res.cloudinary.com/test/image/upload/logo.jpg'),
}));

const UNIQUE = `p4-orgs-${Date.now()}`;

let adminToken: string;
let salesToken: string;
let superAdminToken: string;
let testOrgId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { name: `Org ${UNIQUE}` } });
  testOrgId = org.id;

  const pw = await hashPassword('TestPass123!');
  await prisma.user.createMany({
    data: [
      { email: `${UNIQUE}-admin@test.com`, passwordHash: pw, role: 'ADMIN', organizationId: testOrgId },
      { email: `${UNIQUE}-sales@test.com`, passwordHash: pw, role: 'SALES', organizationId: testOrgId },
      { email: `${UNIQUE}-super@test.com`, passwordHash: pw, role: 'SUPER_ADMIN', organizationId: null },
    ],
  });

  const users = await prisma.user.findMany({
    where: { email: { startsWith: UNIQUE } },
    select: { id: true, email: true, role: true },
  });
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));

  adminToken = signAccessToken({ userId: byEmail[`${UNIQUE}-admin@test.com`].id, role: 'ADMIN', organizationId: testOrgId });
  salesToken = signAccessToken({ userId: byEmail[`${UNIQUE}-sales@test.com`].id, role: 'SALES', organizationId: testOrgId });
  superAdminToken = signAccessToken({ userId: byEmail[`${UNIQUE}-super@test.com`].id, role: 'SUPER_ADMIN', organizationId: null });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: `Org ${UNIQUE}` } } });
  await prisma.$disconnect();
});

// ─── GET /organizations/current ───────────────────────────────────────────────

describe('GET /organizations/current', () => {
  it('returns org id, name, logoUrl for ADMIN', async () => {
    const res = await request(app)
      .get('/organizations/current')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testOrgId);
    expect(res.body.name).toBeDefined();
    expect('logoUrl' in res.body).toBe(true);
  });

  it('returns org for SALES', async () => {
    const res = await request(app)
      .get('/organizations/current')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testOrgId);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/organizations/current');
    expect(res.status).toBe(401);
  });
});

// ─── POST /organizations/:id/logo ─────────────────────────────────────────────

describe('POST /organizations/:id/logo', () => {
  it('returns 400 FILE_REQUIRED when no file sent', async () => {
    const res = await request(app)
      .post(`/organizations/${testOrgId}/logo`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_REQUIRED');
  });

  it('returns 403 FORBIDDEN when ADMIN tries to upload to a different org', async () => {
    const otherOrg = await prisma.organization.create({ data: { name: `Other ${UNIQUE}` } });
    const res = await request(app)
      .post(`/organizations/${otherOrg.id}/logo`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('logo', Buffer.from('fake-image'), { filename: 'logo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it('returns 403 for SALES role', async () => {
    const res = await request(app)
      .post(`/organizations/${testOrgId}/logo`)
      .set('Authorization', `Bearer ${salesToken}`)
      .attach('logo', Buffer.from('fake-image'), { filename: 'logo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
  });

  it('uploads logo and returns logoUrl for ADMIN (mocked Cloudinary)', async () => {
    const res = await request(app)
      .post(`/organizations/${testOrgId}/logo`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('logo', Buffer.from('fake-image-content'), { filename: 'logo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.logoUrl).toBe('https://res.cloudinary.com/test/image/upload/logo.jpg');

    const org = await prisma.organization.findUnique({ where: { id: testOrgId } });
    expect(org!.logoUrl).toBe('https://res.cloudinary.com/test/image/upload/logo.jpg');
  });

  it('SUPER_ADMIN can upload to any org', async () => {
    const res = await request(app)
      .post(`/organizations/${testOrgId}/logo`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('logo', Buffer.from('fake-image-content'), { filename: 'logo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.logoUrl).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/organizations/${testOrgId}/logo`)
      .attach('logo', Buffer.from('fake-image'), { filename: 'logo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });
});
