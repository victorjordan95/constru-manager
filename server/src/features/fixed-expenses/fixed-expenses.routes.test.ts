import request from 'supertest'
import app from '../../app'
import { prisma } from '../../lib/prisma'
import { hashPassword, signAccessToken } from '../auth/auth.service'

const UNIQUE = `p5-fixedexp-${Date.now()}`
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`
const FINANCE_EMAIL = `${UNIQUE}-finance@test.com`
const SALES_EMAIL = `${UNIQUE}-sales@test.com`

let adminToken: string
let financeToken: string
let salesToken: string

beforeAll(async () => {
  const pw = await hashPassword('TestPass123!')
  await prisma.user.createMany({
    data: [
      { email: ADMIN_EMAIL, passwordHash: pw, role: 'ADMIN' },
      { email: FINANCE_EMAIL, passwordHash: pw, role: 'FINANCE' },
      { email: SALES_EMAIL, passwordHash: pw, role: 'SALES' },
    ],
  })
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, FINANCE_EMAIL, SALES_EMAIL] } },
    select: { id: true, email: true, role: true },
  })
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]))
  adminToken = signAccessToken({ userId: byEmail[ADMIN_EMAIL].id, role: byEmail[ADMIN_EMAIL].role })
  financeToken = signAccessToken({ userId: byEmail[FINANCE_EMAIL].id, role: byEmail[FINANCE_EMAIL].role })
  salesToken = signAccessToken({ userId: byEmail[SALES_EMAIL].id, role: byEmail[SALES_EMAIL].role })
})

afterAll(async () => {
  const expenses = await prisma.fixedExpense.findMany({
    where: { name: { startsWith: UNIQUE } },
    select: { id: true },
  })
  const ids = expenses.map((e) => e.id)
  await prisma.fixedExpenseLog.deleteMany({ where: { fixedExpenseId: { in: ids } } })
  await prisma.fixedExpense.deleteMany({ where: { id: { in: ids } } })
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } })
  await prisma.$disconnect()
})

describe('POST /fixed-expenses', () => {
  it('creates fixed expense (ADMIN)', async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Aluguel`, amount: 200000, dueDay: 5, category: 'Infraestrutura' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe(`${UNIQUE} Aluguel`)
    expect(res.body.amount).toBe(200000)
    expect(res.body.dueDay).toBe(5)
    expect(res.body.category).toBe('Infraestrutura')
    expect(res.body.isActive).toBe(true)
  })

  it('creates fixed expense (FINANCE)', async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ name: `${UNIQUE} Internet`, amount: 15000, dueDay: 10 })
    expect(res.status).toBe(201)
    expect(res.body.category).toBeNull()
  })

  it('returns 400 VALIDATION_ERROR for missing name', async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 10000, dueDay: 5 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR for dueDay > 28', async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Bad`, amount: 10000, dueDay: 31 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ name: `${UNIQUE} Blocked`, amount: 10000, dueDay: 5 })
    expect(res.status).toBe(403)
  })

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .send({ name: `${UNIQUE} NoAuth`, amount: 10000, dueDay: 5 })
    expect(res.status).toBe(401)
  })
})

describe('GET /fixed-expenses', () => {
  it('returns 200 array (ADMIN)', async () => {
    const res = await request(app)
      .get('/fixed-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns 200 array (FINANCE)', async () => {
    const res = await request(app)
      .get('/fixed-expenses')
      .set('Authorization', `Bearer ${financeToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .get('/fixed-expenses')
      .set('Authorization', `Bearer ${salesToken}`)
    expect(res.status).toBe(403)
  })
})

describe('PUT /fixed-expenses/:id', () => {
  let expenseId: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} ToEdit`, amount: 50000, dueDay: 15 })
    expenseId = res.body.id
  })

  it('updates name and amount (ADMIN)', async () => {
    const res = await request(app)
      .put(`/fixed-expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} Edited`, amount: 60000 })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe(`${UNIQUE} Edited`)
    expect(res.body.amount).toBe(60000)
    expect(res.body.dueDay).toBe(15)
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/fixed-expenses/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' })
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })
})

describe('DELETE /fixed-expenses/:id', () => {
  let expenseId: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/fixed-expenses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${UNIQUE} ToDelete`, amount: 10000, dueDay: 20 })
    expenseId = res.body.id
  })

  it('soft-deletes (ADMIN) returns 204', async () => {
    const res = await request(app)
      .delete(`/fixed-expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('returns 404 after soft-delete', async () => {
    const res = await request(app)
      .delete(`/fixed-expenses/${expenseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})
