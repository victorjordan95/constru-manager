import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { hashPassword } from './auth.service';

const UNIQUE = `phase2-${Date.now()}`;
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`;
const SALES_EMAIL = `${UNIQUE}-sales@test.com`;
const PASSWORD = 'TestPass123!';

let adminToken: string;
let adminAgent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  // Create test users directly in DB
  await prisma.user.createMany({
    data: [
      {
        email: ADMIN_EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        role: 'ADMIN',
      },
      {
        email: SALES_EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        role: 'SALES',
      },
    ],
  });

  // Log in as admin to get a persistent agent (carries cookies)
  adminAgent = request.agent(app);
  const loginRes = await adminAgent
    .post('/auth/login')
    .send({ email: ADMIN_EMAIL, password: PASSWORD });
  adminToken = loginRes.body.accessToken as string;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
  await prisma.$disconnect();
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('returns 200 with accessToken and sets refreshToken cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join('');
    expect(cookie).toContain('refreshToken');
    expect(cookie).toContain('HttpOnly');
  });

  it('returns 401 INVALID_CREDENTIALS on wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS on unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@nowhere.com', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 400 VALIDATION_ERROR on invalid email format', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('returns 200 with a new accessToken using the refresh cookie', async () => {
    // adminAgent already has the refreshToken cookie from beforeAll login
    const res = await adminAgent.post('/auth/refresh');

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('returns 401 INVALID_TOKEN when no cookie is sent', async () => {
    const res = await request(app).post('/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('returns 204, clears cookie, and blacklists the refresh token', async () => {
    const agent = request.agent(app);
    const loginRes = await agent
      .post('/auth/login')
      .send({ email: SALES_EMAIL, password: PASSWORD });
    const salesToken = loginRes.body.accessToken as string;

    // Capture the raw refresh token from the Set-Cookie header before logout
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken=')) ?? '';
    const rawRefreshToken = refreshCookie.split(';')[0].replace('refreshToken=', '');

    // Logout — agent cookie is cleared by the server
    const logoutRes = await agent
      .post('/auth/logout')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(logoutRes.status).toBe(204);

    // Agent no longer has the cookie → refresh returns INVALID_TOKEN
    const refreshAfterLogout = await agent.post('/auth/refresh');
    expect(refreshAfterLogout.status).toBe(401);

    // Manually sending the (now blacklisted) token returns TOKEN_BLACKLISTED
    if (rawRefreshToken) {
      const blacklistRes = await request(app)
        .post('/auth/refresh')
        .set('Cookie', `refreshToken=${rawRefreshToken}`);
      expect(blacklistRes.status).toBe(401);
      expect(blacklistRes.body.code).toBe('TOKEN_BLACKLISTED');
    }
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('returns 201 with user data when called by ADMIN', async () => {
    const newEmail = `${UNIQUE}-new@test.com`;
    const res = await request(app)
      .post('/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newEmail, password: 'NewUser123!', role: 'SALES' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(newEmail);
    expect(res.body.role).toBe('SALES');
    expect(res.body.passwordHash).toBeUndefined(); // never expose hash
  });

  it('returns 400 EMAIL_TAKEN if email already exists', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: ADMIN_EMAIL, password: 'SomePass123!', role: 'SALES' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('returns 403 FORBIDDEN when called by SALES role', async () => {
    // Log in as sales user
    const salesRes = await request(app)
      .post('/auth/login')
      .send({ email: SALES_EMAIL, password: PASSWORD });
    const salesToken = salesRes.body.accessToken as string;

    const res = await request(app)
      .post('/auth/register')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ email: `${UNIQUE}-other@test.com`, password: 'Pass123!', role: 'SALES' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
