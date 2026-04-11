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
