import request from 'supertest'
import app from '../../app'
import { prisma } from '../../lib/prisma'
import { hashPassword, signAccessToken } from '../auth/auth.service'

const UNIQUE = `p4-quotes-${Date.now()}`

let adminToken: string
let salesToken: string
let clientId: string
let productId: string
let kitId: string
const createdQuoteIds: string[] = []

beforeAll(async () => {
  const pw = await hashPassword('TestPass123!')
  await prisma.user.createMany({
    data: [
      { email: `${UNIQUE}-admin@test.com`, passwordHash: pw, role: 'ADMIN' },
      { email: `${UNIQUE}-sales@test.com`, passwordHash: pw, role: 'SALES' },
    ],
  })
  const users = await prisma.user.findMany({
    where: { email: { in: [`${UNIQUE}-admin@test.com`, `${UNIQUE}-sales@test.com`] } },
    select: { id: true, email: true, role: true },
  })
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]))
  adminToken = signAccessToken({
    userId: byEmail[`${UNIQUE}-admin@test.com`].id,
    role: byEmail[`${UNIQUE}-admin@test.com`].role,
  })
  salesToken = signAccessToken({
    userId: byEmail[`${UNIQUE}-sales@test.com`].id,
    role: byEmail[`${UNIQUE}-sales@test.com`].role,
  })

  const client = await prisma.client.create({
    data: { name: `${UNIQUE} Client`, taxId: `${Date.now()}` },
  })
  clientId = client.id

  const product = await prisma.product.create({
    data: {
      name: `${UNIQUE} Prod`,
      basePrice: 10000,
      markupPercent: 20,
      finalPrice: 12000,
      stockQty: 0,
    },
  })
  productId = product.id

  const kit = await prisma.kit.create({
    data: {
      name: `${UNIQUE} Kit`,
      totalPrice: 25000,
      items: { create: [{ productId, quantity: 2 }] },
    },
  })
  kitId = kit.id
})

afterAll(async () => {
  if (createdQuoteIds.length > 0) {
    await prisma.quote.updateMany({
      where: { id: { in: createdQuoteIds } },
      data: { activeVersionId: null },
    })
    const saleIds = (
      await prisma.sale.findMany({
        where: { quoteId: { in: createdQuoteIds } },
        select: { id: true },
      })
    ).map((s) => s.id)
    await prisma.installment.deleteMany({ where: { saleId: { in: saleIds } } })
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } })
    const versionIds = (
      await prisma.quoteVersion.findMany({
        where: { quoteId: { in: createdQuoteIds } },
        select: { id: true },
      })
    ).map((v) => v.id)
    await prisma.quoteItem.deleteMany({ where: { quoteVersionId: { in: versionIds } } })
    await prisma.quoteVersion.deleteMany({ where: { id: { in: versionIds } } })
    await prisma.quote.deleteMany({ where: { id: { in: createdQuoteIds } } })
  }
  await prisma.kitItem.deleteMany({ where: { kitId } })
  await prisma.kit.delete({ where: { id: kitId } })
  await prisma.product.delete({ where: { id: productId } })
  await prisma.client.delete({ where: { id: clientId } })
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } })
  await prisma.$disconnect()
})

// ─── POST /quotes ─────────────────────────────────────────────────────────────

describe('POST /quotes', () => {
  it('creates quote with product item (ADMIN)', async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId, quantity: 2 }], laborCost: 5000, discount: 1000 })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('PENDING_REVIEW')
    expect(res.body.client.id).toBe(clientId)
    // subtotal = 12000*2 = 24000; total = 24000 + 5000 - 1000 = 28000
    expect(res.body.activeVersion.subtotal).toBe(24000)
    expect(res.body.activeVersion.total).toBe(28000)
    expect(res.body.activeVersion.version).toBe(1)
    expect(res.body.activeVersion.items).toHaveLength(1)
    createdQuoteIds.push(res.body.id)
  })

  it('creates quote with kit item (SALES)', async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ clientId, items: [{ kitId, quantity: 1 }] })
    expect(res.status).toBe(201)
    // subtotal = 25000*1 = 25000; total = 25000
    expect(res.body.activeVersion.subtotal).toBe(25000)
    expect(res.body.activeVersion.total).toBe(25000)
    createdQuoteIds.push(res.body.id)
  })

  it('returns 400 CLIENT_NOT_FOUND for unknown clientId', async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId: 'does-not-exist', items: [{ productId, quantity: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('CLIENT_NOT_FOUND')
  })

  it('returns 400 INVALID_ITEM for unknown productId', async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId: 'does-not-exist', quantity: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_ITEM')
  })

  it('returns 400 VALIDATION_ERROR when items is empty', async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/quotes')
      .send({ clientId, items: [{ productId, quantity: 1 }] })
    expect(res.status).toBe(401)
  })
})

// ─── GET /quotes ──────────────────────────────────────────────────────────────

describe('GET /quotes', () => {
  it('returns 200 array for ADMIN', async () => {
    const res = await request(app)
      .get('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns 200 array for SALES', async () => {
    const res = await request(app)
      .get('/quotes')
      .set('Authorization', `Bearer ${salesToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('returns 401 without token', async () => {
    const res = await request(app).get('/quotes')
    expect(res.status).toBe(401)
  })

  it('each item has client and activeVersion summary', async () => {
    const createRes = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId, quantity: 1 }] })
    createdQuoteIds.push(createRes.body.id)

    const res = await request(app)
      .get('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
    const found = res.body.find((q: { id: string }) => q.id === createRes.body.id)
    expect(found).toBeDefined()
    expect(found.client.id).toBe(clientId)
    expect(found.activeVersion.total).toBe(12000)
  })
})

// ─── GET /quotes/:id ──────────────────────────────────────────────────────────

describe('GET /quotes/:id', () => {
  let quoteId: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId, quantity: 3 }], laborCost: 1000 })
    quoteId = res.body.id
    createdQuoteIds.push(quoteId)
  })

  it('returns full quote with versions and items (ADMIN)', async () => {
    const res = await request(app)
      .get(`/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(quoteId)
    expect(res.body.client.id).toBe(clientId)
    expect(res.body.versions).toHaveLength(1)
    expect(res.body.versions[0].version).toBe(1)
    // subtotal = 12000*3 = 36000; total = 36000 + 1000 = 37000
    expect(res.body.versions[0].total).toBe(37000)
    expect(res.body.versions[0].items).toHaveLength(1)
    expect(res.body.sale).toBeNull()
  })

  it('returns full quote for SALES', async () => {
    const res = await request(app)
      .get(`/quotes/${quoteId}`)
      .set('Authorization', `Bearer ${salesToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(quoteId)
  })

  it('returns 404 NOT_FOUND for unknown id', async () => {
    const res = await request(app)
      .get('/quotes/nonexistent-id')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })

  it('returns 401 without token', async () => {
    const res = await request(app).get(`/quotes/${quoteId}`)
    expect(res.status).toBe(401)
  })
})

// ─── POST /quotes/:id/versions ────────────────────────────────────────────────

describe('POST /quotes/:id/versions', () => {
  let quoteId: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId, quantity: 1 }] })
    quoteId = res.body.id
    createdQuoteIds.push(quoteId)
  })

  it('adds revision v2, updates activeVersionId (ADMIN)', async () => {
    const res = await request(app)
      .post(`/quotes/${quoteId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId, quantity: 2 }], laborCost: 3000 })
    expect(res.status).toBe(200)
    // v2: subtotal = 24000; total = 24000 + 3000 = 27000
    expect(res.body.activeVersion.version).toBe(2)
    expect(res.body.activeVersion.total).toBe(27000)
    expect(res.body.versions).toHaveLength(2)
    expect(res.body.versions[0].version).toBe(1)
    expect(res.body.versions[1].version).toBe(2)
  })

  it('adds revision v3 (SALES)', async () => {
    const res = await request(app)
      .post(`/quotes/${quoteId}/versions`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ items: [{ kitId, quantity: 1 }] })
    expect(res.status).toBe(200)
    expect(res.body.activeVersion.version).toBe(3)
    expect(res.body.versions).toHaveLength(3)
  })

  it('returns 400 INVALID_ITEM for unknown productId', async () => {
    const res = await request(app)
      .post(`/quotes/${quoteId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId: 'not-real', quantity: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_ITEM')
  })

  it('returns 404 NOT_FOUND for unknown quoteId', async () => {
    const res = await request(app)
      .post('/quotes/nonexistent/versions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId, quantity: 1 }] })
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/quotes/${quoteId}/versions`)
      .send({ items: [{ productId, quantity: 1 }] })
    expect(res.status).toBe(401)
  })
})

// ─── PATCH /quotes/:id/status ─────────────────────────────────────────────────

describe('PATCH /quotes/:id/status', () => {
  let quoteId: string

  beforeAll(async () => {
    const res = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId, quantity: 1 }] })
    quoteId = res.body.id
    createdQuoteIds.push(quoteId)
  })

  it('sets status to REJECTED (ADMIN)', async () => {
    const res = await request(app)
      .patch(`/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('REJECTED')
  })

  it('sets status back to PENDING_REVIEW (ADMIN)', async () => {
    const res = await request(app)
      .patch(`/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING_REVIEW' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PENDING_REVIEW')
  })

  it('returns 400 VALIDATION_ERROR for invalid status value ACCEPTED', async () => {
    const res = await request(app)
      .patch(`/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACCEPTED' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 NOT_FOUND for unknown quoteId', async () => {
    const res = await request(app)
      .patch('/quotes/nonexistent/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'REJECTED' })
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .patch(`/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'REJECTED' })
    expect(res.status).toBe(403)
  })

  it('returns 401 without token', async () => {
    const res = await request(app)
      .patch(`/quotes/${quoteId}/status`)
      .send({ status: 'REJECTED' })
    expect(res.status).toBe(401)
  })
})

// ─── POST /quotes/:id/accept ──────────────────────────────────────────────────

describe('POST /quotes/:id/accept', () => {
  let lumpSumQuoteId: string
  let installmentsQuoteId: string

  beforeAll(async () => {
    const [r1, r2] = await Promise.all([
      request(app)
        .post('/quotes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, items: [{ productId, quantity: 2 }], laborCost: 1000 }),
      request(app)
        .post('/quotes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ clientId, items: [{ productId, quantity: 1 }] }),
    ])
    lumpSumQuoteId = r1.body.id
    installmentsQuoteId = r2.body.id
    createdQuoteIds.push(lumpSumQuoteId, installmentsQuoteId)
  })

  it('accepts with LUMP_SUM — status ACCEPTED, sale created, no installments', async () => {
    const res = await request(app)
      .post(`/quotes/${lumpSumQuoteId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentType: 'LUMP_SUM', downPayment: 5000 })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACCEPTED')
    // subtotal = 12000*2 = 24000; total = 24000 + 1000 = 25000
    expect(res.body.sale.total).toBe(25000)
    expect(res.body.sale.paymentType).toBe('LUMP_SUM')
    expect(res.body.sale.downPayment).toBe(5000)
    expect(res.body.sale.installments).toHaveLength(0)
  })

  it('accepts with INSTALLMENTS — status ACCEPTED, sale + installments created', async () => {
    const res = await request(app)
      .post(`/quotes/${installmentsQuoteId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentType: 'INSTALLMENTS',
        downPayment: 0,
        installments: [
          { dueDate: '2026-05-01T00:00:00.000Z', amount: 6000 },
          { dueDate: '2026-06-01T00:00:00.000Z', amount: 6000 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACCEPTED')
    expect(res.body.sale.paymentType).toBe('INSTALLMENTS')
    expect(res.body.sale.installments).toHaveLength(2)
    expect(res.body.sale.installments[0].amount).toBe(6000)
    expect(res.body.sale.installments[0].status).toBe('PENDING')
  })

  it('returns 400 ALREADY_ACCEPTED when quote is already accepted', async () => {
    const res = await request(app)
      .post(`/quotes/${lumpSumQuoteId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentType: 'LUMP_SUM' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ALREADY_ACCEPTED')
  })

  it('returns 400 NO_ACTIVE_VERSION when activeVersionId is null', async () => {
    const createRes = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId, quantity: 1 }] })
    const tempId = createRes.body.id
    createdQuoteIds.push(tempId)
    // Manually null out activeVersionId to simulate the edge case
    await prisma.quote.update({ where: { id: tempId }, data: { activeVersionId: null } })

    const res = await request(app)
      .post(`/quotes/${tempId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentType: 'LUMP_SUM' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_ACTIVE_VERSION')
  })

  it('returns 404 NOT_FOUND for unknown quoteId', async () => {
    const res = await request(app)
      .post('/quotes/nonexistent/accept')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentType: 'LUMP_SUM' })
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .post(`/quotes/${lumpSumQuoteId}/accept`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ paymentType: 'LUMP_SUM' })
    expect(res.status).toBe(403)
  })

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post(`/quotes/${lumpSumQuoteId}/accept`)
      .send({ paymentType: 'LUMP_SUM' })
    expect(res.status).toBe(401)
  })
})
