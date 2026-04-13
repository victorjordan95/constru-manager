# Phase 4: Quotes API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Quotes backend API — create/list/get quotes, add revisions, update status, and accept a quote to generate a Sale with optional installments.

**Architecture:** Each Quote has multiple versioned snapshots (QuoteVersion) with QuoteItems referencing products or kits. Accepting a quote transitions status to ACCEPTED and creates a Sale + Installments. Pure computation helper `computeVersionTotals` is extracted and unit-tested; all other business logic is in `quotes.service.ts`, HTTP handling in `quotes.controller.ts`, and routing/RBAC in `quotes.routes.ts`.

**Tech Stack:** Express, Prisma (PostgreSQL), Zod v3, supertest integration tests, Jest unit tests. Run from `server/` with `npm test`.

---

## Endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /quotes | ADMIN, SALES | List quotes with active-version summary |
| POST | /quotes | ADMIN, SALES | Create quote + first version with items |
| GET | /quotes/:id | ADMIN, SALES | Full quote with all versions |
| POST | /quotes/:id/versions | ADMIN, SALES | Add a revision |
| PATCH | /quotes/:id/status | ADMIN | Update status (PENDING_REVIEW / REJECTED / NO_RESPONSE) |
| POST | /quotes/:id/accept | ADMIN | Accept quote → create Sale + Installments |

## File Structure

| File | Role |
|------|------|
| `server/src/features/quotes/quotes.types.ts` | Zod schemas + inferred TypeScript types |
| `server/src/features/quotes/quotes.service.ts` | `computeVersionTotals` pure helper + all service functions |
| `server/src/features/quotes/quotes.controller.ts` | One handler per endpoint |
| `server/src/features/quotes/quotes.routes.ts` | Express router with per-route RBAC |
| `server/src/features/quotes/quotes.service.test.ts` | Unit tests for `computeVersionTotals` |
| `server/src/features/quotes/quotes.routes.test.ts` | Integration tests for all 6 endpoints |
| `server/src/app.ts` | Mount `quotesRouter` at `/quotes` |

---

### Task 1: Zod schemas and TypeScript types

**Files:**
- Create: `server/src/features/quotes/quotes.types.ts`

- [ ] **Step 1: Create quotes.types.ts**

```typescript
import { z } from 'zod'

export const quoteItemInputSchema = z
  .object({
    productId: z.string().optional(),
    kitId: z.string().optional(),
    quantity: z.number().int().min(1, 'quantity must be at least 1'),
  })
  .refine((d) => Boolean(d.productId) !== Boolean(d.kitId), {
    message: 'Exactly one of productId or kitId must be provided',
  })

export const createQuoteSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  items: z.array(quoteItemInputSchema).min(1, 'Quote must have at least one item'),
  laborCost: z.number().int().min(0).default(0),
  discount: z.number().int().min(0).default(0),
})

export const addVersionSchema = z.object({
  items: z.array(quoteItemInputSchema).min(1, 'Version must have at least one item'),
  laborCost: z.number().int().min(0).default(0),
  discount: z.number().int().min(0).default(0),
})

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING_REVIEW', 'REJECTED', 'NO_RESPONSE']),
})

export const installmentInputSchema = z.object({
  dueDate: z.string().datetime(),
  amount: z.number().int().min(1),
})

export const acceptQuoteSchema = z.object({
  paymentType: z.enum(['LUMP_SUM', 'INSTALLMENTS']),
  downPayment: z.number().int().min(0).default(0),
  installments: z.array(installmentInputSchema).optional(),
})

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type AddVersionInput = z.infer<typeof addVersionSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type InstallmentInput = z.infer<typeof installmentInputSchema>
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>
```

- [ ] **Step 2: Commit**

```bash
git add server/src/features/quotes/quotes.types.ts
git commit -m "feat(quotes): add Zod schemas and TypeScript types"
```

---

### Task 2: Pure computation helper — unit tests + implementation

**Files:**
- Create: `server/src/features/quotes/quotes.service.ts` (partial — helper + includes only)
- Create: `server/src/features/quotes/quotes.service.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `server/src/features/quotes/quotes.service.test.ts`:

```typescript
import { computeVersionTotals } from './quotes.service'

describe('computeVersionTotals', () => {
  it('sums line totals and adds laborCost, subtracts discount', () => {
    // subtotal = 10000 + 5000 = 15000; total = 15000 + 2000 - 500 = 16500
    expect(computeVersionTotals([10000, 5000], 2000, 500)).toEqual({
      subtotal: 15000,
      total: 16500,
    })
  })

  it('returns 0 for empty items with no extra costs', () => {
    expect(computeVersionTotals([], 0, 0)).toEqual({ subtotal: 0, total: 0 })
  })

  it('handles zero laborCost and zero discount', () => {
    expect(computeVersionTotals([8000], 0, 0)).toEqual({ subtotal: 8000, total: 8000 })
  })

  it('allows discount larger than subtotal (negative total)', () => {
    expect(computeVersionTotals([1000], 0, 2000)).toEqual({ subtotal: 1000, total: -1000 })
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.service.test" --no-coverage
```

Expected: FAIL — "Cannot find module './quotes.service'"

- [ ] **Step 3: Create quotes.service.ts with helper + shared includes**

Create `server/src/features/quotes/quotes.service.ts`:

```typescript
import { prisma } from '../../lib/prisma'
import {
  CreateQuoteInput,
  AddVersionInput,
  UpdateStatusInput,
  AcceptQuoteInput,
} from './quotes.types'

// ─── Pure helper ──────────────────────────────────────────────────────────────

export function computeVersionTotals(
  lineTotals: number[],
  laborCost: number,
  discount: number,
): { subtotal: number; total: number } {
  const subtotal = lineTotals.reduce((s, t) => s + t, 0)
  return { subtotal, total: subtotal + laborCost - discount }
}

// ─── Shared Prisma includes ────────────────────────────────────────────────────

const quoteItemInclude = {
  product: { select: { id: true, name: true, unit: true } },
  kit: { select: { id: true, name: true } },
} as const

const quoteVersionInclude = {
  items: { include: quoteItemInclude },
} as const

// Used by getQuote — full detail
const quoteDetailInclude = {
  client: { select: { id: true, name: true } },
  activeVersion: { include: quoteVersionInclude },
  versions: {
    include: quoteVersionInclude,
    orderBy: { version: 'asc' as const },
  },
  sale: {
    include: {
      installments: { orderBy: { dueDate: 'asc' as const } },
    },
  },
} as const

// Used by listQuotes — lightweight summary
const quoteListInclude = {
  client: { select: { id: true, name: true } },
  activeVersion: {
    select: {
      id: true,
      version: true,
      subtotal: true,
      laborCost: true,
      discount: true,
      total: true,
      createdAt: true,
    },
  },
} as const

// Service functions are added in Tasks 3-7.
// Export a placeholder so the file compiles without unused-import errors.
export const _quotesServiceReady = true
```

- [ ] **Step 4: Run to verify PASS**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.service.test" --no-coverage
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/features/quotes/quotes.service.ts server/src/features/quotes/quotes.service.test.ts
git commit -m "feat(quotes): add computeVersionTotals with unit tests"
```

---

### Task 3: createQuote + POST /quotes

**Files:**
- Modify: `server/src/features/quotes/quotes.service.ts` (add `createQuote`, remove placeholder export)
- Create: `server/src/features/quotes/quotes.controller.ts`
- Create: `server/src/features/quotes/quotes.routes.ts`
- Modify: `server/src/app.ts` (mount router so app compiles)
- Create: `server/src/features/quotes/quotes.routes.test.ts` (POST /quotes describe block + beforeAll/afterAll)

- [ ] **Step 1: Write the failing integration test**

Create `server/src/features/quotes/quotes.routes.test.ts`:

```typescript
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
  // Clear circular reference Quote ↔ QuoteVersion before bulk delete
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
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --no-coverage
```

Expected: FAIL — 404 on POST /quotes (route not mounted yet)

- [ ] **Step 3: Add createQuote to quotes.service.ts**

Replace the placeholder export at the bottom of `server/src/features/quotes/quotes.service.ts` with:

```typescript
// ─── Service functions ─────────────────────────────────────────────────────────

export async function createQuote(data: CreateQuoteInput) {
  const client = await prisma.client.findFirst({ where: { id: data.clientId } })
  if (!client) return { error: 'CLIENT_NOT_FOUND' as const }

  const productIds = data.items.filter((i) => i.productId).map((i) => i.productId!)
  const kitIds = data.items.filter((i) => i.kitId).map((i) => i.kitId!)

  const [products, kits] = await Promise.all([
    productIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, finalPrice: true },
        })
      : Promise.resolve([]),
    kitIds.length > 0
      ? prisma.kit.findMany({
          where: { id: { in: kitIds }, isActive: true },
          select: { id: true, totalPrice: true },
        })
      : Promise.resolve([]),
  ])

  const productPriceMap = new Map(products.map((p) => [p.id, p.finalPrice]))
  const kitPriceMap = new Map(
    (kits as { id: string; totalPrice: number }[]).map((k) => [k.id, k.totalPrice]),
  )

  const missingProductIds = productIds.filter((id) => !productPriceMap.has(id))
  const missingKitIds = kitIds.filter((id) => !kitPriceMap.has(id))
  if (missingProductIds.length > 0 || missingKitIds.length > 0) {
    return { error: 'INVALID_ITEM' as const }
  }

  const itemsWithPrices = data.items.map((item) => {
    const unitPrice = item.productId
      ? productPriceMap.get(item.productId)!
      : kitPriceMap.get(item.kitId!)!
    return {
      productId: item.productId ?? null,
      kitId: item.kitId ?? null,
      quantity: item.quantity,
      unitPrice,
      lineTotal: item.quantity * unitPrice,
    }
  })

  const { subtotal, total } = computeVersionTotals(
    itemsWithPrices.map((i) => i.lineTotal),
    data.laborCost,
    data.discount,
  )

  const quote = await prisma.$transaction(async (tx) => {
    const newQuote = await tx.quote.create({ data: { clientId: data.clientId } })
    const version = await tx.quoteVersion.create({
      data: {
        quoteId: newQuote.id,
        version: 1,
        subtotal,
        laborCost: data.laborCost,
        discount: data.discount,
        total,
        items: { create: itemsWithPrices },
      },
    })
    return tx.quote.update({
      where: { id: newQuote.id },
      data: { activeVersionId: version.id },
      include: quoteDetailInclude,
    })
  })

  return { quote }
}

// Stubs — implemented in Tasks 4-7
export async function listQuotes() {
  return prisma.quote.findMany({
    include: quoteListInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getQuote(_id: string): Promise<{ error: 'NOT_FOUND' } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}

export async function addVersion(
  _id: string,
  _data: AddVersionInput,
): Promise<{ error: string } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}

export async function updateStatus(
  _id: string,
  _data: UpdateStatusInput,
): Promise<{ error: 'NOT_FOUND' } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}

export async function acceptQuote(
  _id: string,
  _data: AcceptQuoteInput,
): Promise<{ error: string } | { quote: unknown }> {
  return { error: 'NOT_FOUND' as const }
}
```

- [ ] **Step 4: Create quotes.controller.ts**

Create `server/src/features/quotes/quotes.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import {
  createQuote,
  listQuotes,
  getQuote,
  addVersion,
  updateStatus,
  acceptQuote,
} from './quotes.service'
import {
  createQuoteSchema,
  addVersionSchema,
  updateStatusSchema,
  acceptQuoteSchema,
} from './quotes.types'

export async function handleCreateQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createQuoteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await createQuote(parsed.data)
    if ('error' in result) {
      res.status(400).json({ error: result.error, code: result.error })
      return
    }
    res.status(201).json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleListQuotes(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listQuotes())
  } catch (err) {
    next(err)
  }
}

export async function handleGetQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getQuote(req.params.id as string)
    if ('error' in result) {
      res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleAddVersion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = addVersionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await addVersion(req.params.id as string, parsed.data)
    if ('error' in result) {
      const code = result.error
      const status = code === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: code, code })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleUpdateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await updateStatus(req.params.id as string, parsed.data)
    if ('error' in result) {
      res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleAcceptQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = acceptQuoteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await acceptQuote(req.params.id as string, parsed.data)
    if ('error' in result) {
      const code = result.error
      const status = code === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: code, code })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 5: Create quotes.routes.ts**

Create `server/src/features/quotes/quotes.routes.ts`:

```typescript
import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate'
import { authorize } from '../../middlewares/authorize'
import {
  handleCreateQuote,
  handleListQuotes,
  handleGetQuote,
  handleAddVersion,
  handleUpdateStatus,
  handleAcceptQuote,
} from './quotes.controller'

export const quotesRouter = Router()

quotesRouter.use(authenticate)

// ADMIN + SALES
quotesRouter.get('/', authorize('ADMIN', 'SALES'), handleListQuotes)
quotesRouter.post('/', authorize('ADMIN', 'SALES'), handleCreateQuote)
quotesRouter.get('/:id', authorize('ADMIN', 'SALES'), handleGetQuote)
quotesRouter.post('/:id/versions', authorize('ADMIN', 'SALES'), handleAddVersion)

// ADMIN only
quotesRouter.patch('/:id/status', authorize('ADMIN'), handleUpdateStatus)
quotesRouter.post('/:id/accept', authorize('ADMIN'), handleAcceptQuote)
```

- [ ] **Step 6: Mount in app.ts**

In `server/src/app.ts`, add after the kits import and route:

```typescript
import { quotesRouter } from './features/quotes/quotes.routes'
// ...
app.use('/quotes', quotesRouter)
```

Full file after edit:

```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import { healthRouter } from './routes/health'
import { authRouter } from './features/auth/auth.routes'
import { clientsRouter } from './features/clients/clients.routes'
import { productsRouter } from './features/products/products.routes'
import { kitsRouter } from './features/kits/kits.routes'
import { quotesRouter } from './features/quotes/quotes.routes'
import { errorHandler } from './middlewares/errorHandler'

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// Routes
app.use('/health', healthRouter)
app.use('/auth', authRouter)
app.use('/clients', clientsRouter)
app.use('/products', productsRouter)
app.use('/kits', kitsRouter)
app.use('/quotes', quotesRouter)

// Centralized error handler — must be last
app.use(errorHandler)

export default app
```

- [ ] **Step 7: Run POST /quotes tests to verify PASS**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="POST /quotes" --no-coverage
```

Expected: PASS — 6 tests

- [ ] **Step 8: Commit**

```bash
git add server/src/features/quotes/quotes.types.ts server/src/features/quotes/quotes.service.ts server/src/features/quotes/quotes.controller.ts server/src/features/quotes/quotes.routes.ts server/src/app.ts server/src/features/quotes/quotes.routes.test.ts
git commit -m "feat(quotes): add createQuote service + POST /quotes endpoint"
```

---

### Task 4: listQuotes + getQuote (GET /quotes, GET /quotes/:id)

**Files:**
- Modify: `server/src/features/quotes/quotes.service.ts` (replace `listQuotes` + `getQuote` stubs)
- Modify: `server/src/features/quotes/quotes.routes.test.ts` (add GET describe blocks)

- [ ] **Step 1: Add GET describe blocks to quotes.routes.test.ts**

Append to the end of `server/src/features/quotes/quotes.routes.test.ts`:

```typescript
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
    // Create a quote specifically for this assertion
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
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="GET /quotes" --no-coverage
```

Expected: FAIL — GET /quotes/:id returns 404 for the valid quoteId (stub always returns NOT_FOUND)

- [ ] **Step 3: Replace listQuotes and getQuote stubs in quotes.service.ts**

Replace the two stub functions in `server/src/features/quotes/quotes.service.ts`:

```typescript
export async function listQuotes() {
  return prisma.quote.findMany({
    include: quoteListInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getQuote(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: quoteDetailInclude,
  })
  if (!quote) return { error: 'NOT_FOUND' as const }
  return { quote }
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="GET /quotes" --no-coverage
```

Expected: PASS — all GET /quotes and GET /quotes/:id tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/features/quotes/quotes.service.ts server/src/features/quotes/quotes.routes.test.ts
git commit -m "feat(quotes): add listQuotes and getQuote (GET /quotes, GET /quotes/:id)"
```

---

### Task 5: addVersion (POST /quotes/:id/versions)

**Files:**
- Modify: `server/src/features/quotes/quotes.service.ts` (replace `addVersion` stub)
- Modify: `server/src/features/quotes/quotes.routes.test.ts` (add POST /quotes/:id/versions describe block)

- [ ] **Step 1: Add describe block to quotes.routes.test.ts**

Append to `server/src/features/quotes/quotes.routes.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="POST /quotes/:id/versions" --no-coverage
```

Expected: FAIL — stub returns NOT_FOUND for valid quote

- [ ] **Step 3: Replace addVersion stub in quotes.service.ts**

```typescript
export async function addVersion(id: string, data: AddVersionInput) {
  const existing = await prisma.quote.findUnique({
    where: { id },
    include: { versions: { select: { version: true }, orderBy: { version: 'desc' } } },
  })
  if (!existing) return { error: 'NOT_FOUND' as const }

  const productIds = data.items.filter((i) => i.productId).map((i) => i.productId!)
  const kitIds = data.items.filter((i) => i.kitId).map((i) => i.kitId!)

  const [products, kits] = await Promise.all([
    productIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, finalPrice: true },
        })
      : Promise.resolve([]),
    kitIds.length > 0
      ? prisma.kit.findMany({
          where: { id: { in: kitIds }, isActive: true },
          select: { id: true, totalPrice: true },
        })
      : Promise.resolve([]),
  ])

  const productPriceMap = new Map(products.map((p) => [p.id, p.finalPrice]))
  const kitPriceMap = new Map(
    (kits as { id: string; totalPrice: number }[]).map((k) => [k.id, k.totalPrice]),
  )

  const missingProductIds = productIds.filter((pid) => !productPriceMap.has(pid))
  const missingKitIds = kitIds.filter((kid) => !kitPriceMap.has(kid))
  if (missingProductIds.length > 0 || missingKitIds.length > 0) {
    return { error: 'INVALID_ITEM' as const }
  }

  const itemsWithPrices = data.items.map((item) => {
    const unitPrice = item.productId
      ? productPriceMap.get(item.productId)!
      : kitPriceMap.get(item.kitId!)!
    return {
      productId: item.productId ?? null,
      kitId: item.kitId ?? null,
      quantity: item.quantity,
      unitPrice,
      lineTotal: item.quantity * unitPrice,
    }
  })

  const { subtotal, total } = computeVersionTotals(
    itemsWithPrices.map((i) => i.lineTotal),
    data.laborCost,
    data.discount,
  )

  const nextVersion = (existing.versions[0]?.version ?? 0) + 1

  const quote = await prisma.$transaction(async (tx) => {
    const version = await tx.quoteVersion.create({
      data: {
        quoteId: id,
        version: nextVersion,
        subtotal,
        laborCost: data.laborCost,
        discount: data.discount,
        total,
        items: { create: itemsWithPrices },
      },
    })
    return tx.quote.update({
      where: { id },
      data: { activeVersionId: version.id },
      include: quoteDetailInclude,
    })
  })

  return { quote }
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="POST /quotes/:id/versions" --no-coverage
```

Expected: PASS — all addVersion tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/features/quotes/quotes.service.ts server/src/features/quotes/quotes.routes.test.ts
git commit -m "feat(quotes): add addVersion (POST /quotes/:id/versions)"
```

---

### Task 6: updateStatus (PATCH /quotes/:id/status)

**Files:**
- Modify: `server/src/features/quotes/quotes.service.ts` (replace `updateStatus` stub)
- Modify: `server/src/features/quotes/quotes.routes.test.ts` (add PATCH /quotes/:id/status describe block)

- [ ] **Step 1: Add describe block to quotes.routes.test.ts**

Append to `server/src/features/quotes/quotes.routes.test.ts`:

```typescript
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

  it('returns 400 VALIDATION_ERROR for invalid status value', async () => {
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
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="PATCH /quotes/:id/status" --no-coverage
```

Expected: FAIL — stub returns NOT_FOUND for valid quote

- [ ] **Step 3: Replace updateStatus stub in quotes.service.ts**

```typescript
export async function updateStatus(id: string, data: UpdateStatusInput) {
  const existing = await prisma.quote.findUnique({ where: { id } })
  if (!existing) return { error: 'NOT_FOUND' as const }

  const quote = await prisma.quote.update({
    where: { id },
    data: { status: data.status },
    include: quoteDetailInclude,
  })
  return { quote }
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="PATCH /quotes/:id/status" --no-coverage
```

Expected: PASS — all updateStatus tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/features/quotes/quotes.service.ts server/src/features/quotes/quotes.routes.test.ts
git commit -m "feat(quotes): add updateStatus (PATCH /quotes/:id/status)"
```

---

### Task 7: acceptQuote (POST /quotes/:id/accept)

**Files:**
- Modify: `server/src/features/quotes/quotes.service.ts` (replace `acceptQuote` stub)
- Modify: `server/src/features/quotes/quotes.routes.test.ts` (add POST /quotes/:id/accept describe block)

- [ ] **Step 1: Add describe block to quotes.routes.test.ts**

Append to `server/src/features/quotes/quotes.routes.test.ts`:

```typescript
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
    // subtotal = 24000; total = 24000 + 1000 = 25000
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

  it('returns 400 NO_ACTIVE_VERSION when quote has no activeVersion', async () => {
    // Create a quote, then manually null out activeVersionId
    const createRes = await request(app)
      .post('/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ clientId, items: [{ productId, quantity: 1 }] })
    const tempId = createRes.body.id
    createdQuoteIds.push(tempId)
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
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="POST /quotes/:id/accept" --no-coverage
```

Expected: FAIL — stub returns NOT_FOUND for valid quote

- [ ] **Step 3: Replace acceptQuote stub in quotes.service.ts**

```typescript
export async function acceptQuote(id: string, data: AcceptQuoteInput) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      activeVersion: true,
      sale: true,
    },
  })
  if (!quote) return { error: 'NOT_FOUND' as const }
  if (quote.status === 'ACCEPTED') return { error: 'ALREADY_ACCEPTED' as const }
  if (!quote.activeVersion) return { error: 'NO_ACTIVE_VERSION' as const }

  const total = quote.activeVersion.total

  const updatedQuote = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        quoteId: id,
        paymentType: data.paymentType,
        downPayment: data.downPayment,
        total,
        ...(data.installments && data.installments.length > 0
          ? {
              installments: {
                create: data.installments.map((inst) => ({
                  dueDate: new Date(inst.dueDate),
                  amount: inst.amount,
                })),
              },
            }
          : {}),
      },
    })
    void sale // used for transaction
    return tx.quote.update({
      where: { id },
      data: { status: 'ACCEPTED' },
      include: quoteDetailInclude,
    })
  })

  return { quote: updatedQuote }
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes.routes.test" --testNamePattern="POST /quotes/:id/accept" --no-coverage
```

Expected: PASS — all acceptQuote tests pass

- [ ] **Step 5: Run the full quotes test suite**

```bash
cd /c/freela/constru-manager/server && npm test -- --testPathPattern="quotes" --no-coverage
```

Expected: PASS — all tests in quotes.service.test.ts and quotes.routes.test.ts pass

- [ ] **Step 6: Commit**

```bash
git add server/src/features/quotes/quotes.service.ts server/src/features/quotes/quotes.routes.test.ts
git commit -m "feat(quotes): add acceptQuote with Sale + Installments (POST /quotes/:id/accept)"
```

---

### Task 8: Full regression + final cleanup

**Files:**
- No new files; verify all existing tests still pass

- [ ] **Step 1: Run the full server test suite**

```bash
cd /c/freela/constru-manager/server && npm test --no-coverage
```

Expected: all test files pass (auth, clients, products, kits, quotes)

- [ ] **Step 2: Commit if any cleanup was needed; otherwise confirm done**

```bash
git add -A
git commit -m "feat(quotes): complete Phase 4 Quotes API backend"
```

If no changes were needed, skip this commit — the implementation is complete.

---

## Self-Review Checklist

**Spec coverage:**
- [x] GET /quotes — ADMIN + SALES — list with summary
- [x] POST /quotes — ADMIN + SALES — create with first version
- [x] GET /quotes/:id — ADMIN + SALES — full detail with all versions
- [x] POST /quotes/:id/versions — ADMIN + SALES — add revision, increment version number, update activeVersionId
- [x] PATCH /quotes/:id/status — ADMIN only — PENDING_REVIEW / REJECTED / NO_RESPONSE (ACCEPTED blocked via schema)
- [x] POST /quotes/:id/accept — ADMIN only — ACCEPTED + Sale + optional Installments
- [x] Items: exactly one of productId or kitId (Zod refine)
- [x] unitPrice = product.finalPrice or kit.totalPrice (looked up at creation time)
- [x] lineTotal = quantity × unitPrice
- [x] subtotal = sum(lineTotal), total = subtotal + laborCost − discount
- [x] Accept guards: NOT_FOUND, ALREADY_ACCEPTED, NO_ACTIVE_VERSION
- [x] Integration tests cover auth (401/403), business errors, and happy paths
- [x] Unit tests cover computeVersionTotals

**Placeholder scan:** No TBDs, no "implement later", no "add error handling" without code.

**Type consistency:** `computeVersionTotals` defined in Task 2, called in Tasks 3 and 5 with same signature. `quoteDetailInclude` defined in Task 2, used in Tasks 3, 5, 6, 7. `acceptQuote` service accepts `AcceptQuoteInput` defined in Task 1.
