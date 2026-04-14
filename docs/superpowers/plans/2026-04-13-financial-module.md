# Financial Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a financial dashboard (cash balance, monthly incoming/outgoing/net profit, mark installments and fixed expenses as paid) plus a fixed expenses CRUD, accessible to ADMIN and FINANCE roles.

**Architecture:** Two new server feature modules (`finance`, `fixed-expenses`) with standard routes/controller/service/types structure, plus two new client feature folders. One new Prisma model (`FinanceSettings`) and one new unique constraint on `FixedExpenseLog`. All restricted to ADMIN and FINANCE roles.

**Tech Stack:** Express + Prisma + Zod (server), React 19 + TanStack Query v5 + TanStack Router v1 (client), Jest + supertest (server tests), TypeScript throughout.

---

## File Map

**Server — create:**
- `server/src/features/fixed-expenses/fixed-expenses.types.ts`
- `server/src/features/fixed-expenses/fixed-expenses.service.ts`
- `server/src/features/fixed-expenses/fixed-expenses.controller.ts`
- `server/src/features/fixed-expenses/fixed-expenses.routes.ts`
- `server/src/features/fixed-expenses/fixed-expenses.routes.test.ts`
- `server/src/features/finance/finance.types.ts`
- `server/src/features/finance/finance.service.ts`
- `server/src/features/finance/finance.controller.ts`
- `server/src/features/finance/finance.routes.ts`
- `server/src/features/finance/finance.routes.test.ts`
- `server/src/features/finance/finance.service.test.ts`

**Server — modify:**
- `server/src/prisma/schema.prisma` (add FinanceSettings, add @@unique to FixedExpenseLog)
- `server/src/app.ts` (register financeRouter and fixedExpensesRouter)

**Client — create:**
- `client/src/features/fixed-expenses/types.ts`
- `client/src/features/fixed-expenses/api.ts`
- `client/src/features/fixed-expenses/hooks.ts`
- `client/src/features/fixed-expenses/FixedExpensesListPage.tsx`
- `client/src/features/fixed-expenses/FixedExpenseFormPage.tsx`
- `client/src/features/finance/types.ts`
- `client/src/features/finance/api.ts`
- `client/src/features/finance/hooks.ts`
- `client/src/features/finance/FinanceDashboardPage.tsx`

**Client — modify:**
- `client/src/router/index.tsx` (add 4 new routes)
- `client/src/layouts/AppLayout.tsx` (add nav links for ADMIN+FINANCE)

---

### Task 1: Schema migration — add FinanceSettings and FixedExpenseLog unique constraint

**Files:**
- Modify: `server/src/prisma/schema.prisma`

- [ ] **Step 1: Add FinanceSettings model and @@unique to FixedExpenseLog**

Open `server/src/prisma/schema.prisma` and make two changes:

After the `FixedExpense` model, modify `FixedExpenseLog` to add `@@unique`:

```prisma
model FixedExpenseLog {
  id             String           @id @default(cuid())
  fixedExpense   FixedExpense     @relation(fields: [fixedExpenseId], references: [id])
  fixedExpenseId String
  month          Int
  year           Int
  status         ExpenseLogStatus @default(PENDING)
  paidAt         DateTime?
  transaction    CashTransaction?

  @@unique([fixedExpenseId, month, year])
}
```

Then add `FinanceSettings` model at the end of the file:

```prisma
model FinanceSettings {
  id             String @id @default("singleton")
  openingBalance Int    @default(0)
}
```

- [ ] **Step 2: Run migration**

```bash
cd server && npm run prisma:migrate -- --name add_finance_settings
```

Expected: `The following migration(s) have been created and applied` (or similar success message). Prisma regenerates the client automatically.

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add server/src/prisma/schema.prisma server/src/prisma/migrations/
git commit -m "feat(db): add FinanceSettings model and FixedExpenseLog unique constraint"
```

---

### Task 2: Fixed expenses server feature

**Files:**
- Create: `server/src/features/fixed-expenses/fixed-expenses.types.ts`
- Create: `server/src/features/fixed-expenses/fixed-expenses.service.ts`
- Create: `server/src/features/fixed-expenses/fixed-expenses.controller.ts`
- Create: `server/src/features/fixed-expenses/fixed-expenses.routes.ts`
- Create: `server/src/features/fixed-expenses/fixed-expenses.routes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/features/fixed-expenses/fixed-expenses.routes.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx jest src/features/fixed-expenses/fixed-expenses.routes.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../app'` or similar (files don't exist yet).

- [ ] **Step 3: Create types**

Create `server/src/features/fixed-expenses/fixed-expenses.types.ts`:

```ts
import { z } from 'zod'

export const createFixedExpenseSchema = z.object({
  name: z.string().min(1, 'name is required'),
  amount: z.number().int().min(1, 'amount must be at least 1'),
  dueDay: z.number().int().min(1).max(28, 'dueDay must be between 1 and 28'),
  category: z.string().optional(),
})

export const updateFixedExpenseSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().int().min(1).optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
  category: z.string().optional(),
})

export type CreateFixedExpenseInput = z.infer<typeof createFixedExpenseSchema>
export type UpdateFixedExpenseInput = z.infer<typeof updateFixedExpenseSchema>
```

- [ ] **Step 4: Create service**

Create `server/src/features/fixed-expenses/fixed-expenses.service.ts`:

```ts
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { CreateFixedExpenseInput, UpdateFixedExpenseInput } from './fixed-expenses.types'

export function listFixedExpenses() {
  return prisma.fixedExpense.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
}

export function getFixedExpense(id: string) {
  return prisma.fixedExpense.findFirst({ where: { id, isActive: true } })
}

export function createFixedExpense(data: CreateFixedExpenseInput) {
  return prisma.fixedExpense.create({
    data: {
      name: data.name,
      amount: data.amount,
      dueDay: data.dueDay,
      category: data.category ?? null,
    },
  })
}

export async function updateFixedExpense(id: string, data: UpdateFixedExpenseInput) {
  try {
    return await prisma.fixedExpense.update({
      where: { id, isActive: true },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.dueDay !== undefined && { dueDay: data.dueDay }),
        ...(data.category !== undefined && { category: data.category }),
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return null
    }
    throw err
  }
}

export async function softDeleteFixedExpense(id: string): Promise<boolean> {
  try {
    await prisma.fixedExpense.update({ where: { id, isActive: true }, data: { isActive: false } })
    return true
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return false
    }
    throw err
  }
}
```

- [ ] **Step 5: Create controller**

Create `server/src/features/fixed-expenses/fixed-expenses.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import {
  listFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  softDeleteFixedExpense,
} from './fixed-expenses.service'
import { createFixedExpenseSchema, updateFixedExpenseSchema } from './fixed-expenses.types'

export async function handleListFixedExpenses(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listFixedExpenses())
  } catch (err) {
    next(err)
  }
}

export async function handleCreateFixedExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createFixedExpenseSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    res.status(201).json(await createFixedExpense(parsed.data))
  } catch (err) {
    next(err)
  }
}

export async function handleUpdateFixedExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateFixedExpenseSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await updateFixedExpense(req.params.id as string, parsed.data)
    if (!result) {
      res.status(404).json({ error: 'Fixed expense not found', code: 'NOT_FOUND' })
      return
    }
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function handleDeleteFixedExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ok = await softDeleteFixedExpense(req.params.id as string)
    if (!ok) {
      res.status(404).json({ error: 'Fixed expense not found', code: 'NOT_FOUND' })
      return
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 6: Create routes**

Create `server/src/features/fixed-expenses/fixed-expenses.routes.ts`:

```ts
import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate'
import { authorize } from '../../middlewares/authorize'
import {
  handleListFixedExpenses,
  handleCreateFixedExpense,
  handleUpdateFixedExpense,
  handleDeleteFixedExpense,
} from './fixed-expenses.controller'

export const fixedExpensesRouter = Router()

fixedExpensesRouter.use(authenticate, authorize('ADMIN', 'FINANCE'))

fixedExpensesRouter.get('/', handleListFixedExpenses)
fixedExpensesRouter.post('/', handleCreateFixedExpense)
fixedExpensesRouter.put('/:id', handleUpdateFixedExpense)
fixedExpensesRouter.delete('/:id', handleDeleteFixedExpense)
```

- [ ] **Step 7: Run tests**

```bash
cd server && npx jest src/features/fixed-expenses/fixed-expenses.routes.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/features/fixed-expenses/
git commit -m "feat(server): add fixed-expenses feature (CRUD, ADMIN+FINANCE only)"
```

---

### Task 3: Finance server feature

**Files:**
- Create: `server/src/features/finance/finance.service.test.ts`
- Create: `server/src/features/finance/finance.types.ts`
- Create: `server/src/features/finance/finance.service.ts`
- Create: `server/src/features/finance/finance.controller.ts`
- Create: `server/src/features/finance/finance.routes.ts`
- Create: `server/src/features/finance/finance.routes.test.ts`

- [ ] **Step 1: Write the service unit test (pure function)**

Create `server/src/features/finance/finance.service.test.ts`:

```ts
import { computeBalance } from './finance.service'

describe('computeBalance', () => {
  it('returns openingBalance when no transactions', () => {
    expect(computeBalance(50000, [])).toBe(50000)
  })

  it('adds INCOME and subtracts EXPENSE', () => {
    const txs = [
      { type: 'INCOME' as const, amount: 30000 },
      { type: 'INCOME' as const, amount: 20000 },
      { type: 'EXPENSE' as const, amount: 10000 },
    ]
    // 50000 + 30000 + 20000 - 10000 = 90000
    expect(computeBalance(50000, txs)).toBe(90000)
  })

  it('handles zero opening balance', () => {
    const txs = [{ type: 'INCOME' as const, amount: 15000 }]
    expect(computeBalance(0, txs)).toBe(15000)
  })

  it('returns negative when expenses exceed income + opening', () => {
    const txs = [{ type: 'EXPENSE' as const, amount: 5000 }]
    expect(computeBalance(0, txs)).toBe(-5000)
  })
})
```

- [ ] **Step 2: Run unit test to verify it fails**

```bash
cd server && npx jest src/features/finance/finance.service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './finance.service'`.

- [ ] **Step 3: Write the routes integration test**

Create `server/src/features/finance/finance.routes.test.ts`:

```ts
import request from 'supertest'
import app from '../../app'
import { prisma } from '../../lib/prisma'
import { hashPassword, signAccessToken } from '../auth/auth.service'

const UNIQUE = `p5-finance-${Date.now()}`
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`
const FINANCE_EMAIL = `${UNIQUE}-finance@test.com`
const SALES_EMAIL = `${UNIQUE}-sales@test.com`

let adminToken: string
let financeToken: string
let salesToken: string
let installmentId: string
let expenseLogId: string
let fixedExpenseId: string

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

  // Create a client, product, quote, sale, and installment for pay tests
  const client = await prisma.client.create({ data: { name: `${UNIQUE} Client`, taxId: `FIN${Date.now()}` } })
  const product = await prisma.product.create({
    data: { name: `${UNIQUE} Prod`, basePrice: 10000, markupPercent: 20, finalPrice: 12000, stockQty: 0 },
  })
  const quote = await prisma.quote.create({ data: { clientId: client.id } })
  const version = await prisma.quoteVersion.create({
    data: { quoteId: quote.id, version: 1, subtotal: 12000, laborCost: 0, discount: 0, total: 12000,
      items: { create: [{ productId: product.id, quantity: 1, unitPrice: 12000, lineTotal: 12000 }] } },
  })
  await prisma.quote.update({ where: { id: quote.id }, data: { activeVersionId: version.id, status: 'ACCEPTED' } })
  const sale = await prisma.sale.create({
    data: { quoteId: quote.id, paymentType: 'INSTALLMENTS', downPayment: 0, total: 12000 },
  })
  const installment = await prisma.installment.create({
    data: { saleId: sale.id, dueDate: new Date(), amount: 12000 },
  })
  installmentId = installment.id

  // Create a fixed expense and its log for pay tests
  const expense = await prisma.fixedExpense.create({
    data: { name: `${UNIQUE} Conta Luz`, amount: 30000, dueDay: 10 },
  })
  fixedExpenseId = expense.id
  const now = new Date()
  const log = await prisma.fixedExpenseLog.create({
    data: { fixedExpenseId: expense.id, month: now.getMonth() + 1, year: now.getFullYear() },
  })
  expenseLogId = log.id
})

afterAll(async () => {
  await prisma.cashTransaction.deleteMany({
    where: { OR: [{ installmentId }, { fixedExpenseLogId: expenseLogId }] },
  })
  await prisma.installment.deleteMany({ where: { id: installmentId } })
  const saleId = (await prisma.installment.findUnique({ where: { id: installmentId }, select: { saleId: true } }))?.saleId
  if (saleId) await prisma.sale.delete({ where: { id: saleId } })
  await prisma.quoteItem.deleteMany({ where: { quoteVersion: { quote: { clientId: (await prisma.client.findFirst({ where: { name: `${UNIQUE} Client` }, select: { id: true } }))?.id ?? '' } } } })
  const clientRecord = await prisma.client.findFirst({ where: { name: `${UNIQUE} Client` }, select: { id: true } })
  if (clientRecord) {
    const quotes = await prisma.quote.findMany({ where: { clientId: clientRecord.id }, select: { id: true } })
    const qIds = quotes.map((q) => q.id)
    const versions = await prisma.quoteVersion.findMany({ where: { quoteId: { in: qIds } }, select: { id: true } })
    await prisma.quoteItem.deleteMany({ where: { quoteVersionId: { in: versions.map((v) => v.id) } } })
    await prisma.quoteVersion.deleteMany({ where: { quoteId: { in: qIds } } })
    await prisma.quote.deleteMany({ where: { id: { in: qIds } } })
    await prisma.client.delete({ where: { id: clientRecord.id } })
  }
  await prisma.product.deleteMany({ where: { name: { startsWith: UNIQUE } } })
  await prisma.fixedExpenseLog.deleteMany({ where: { fixedExpenseId } })
  await prisma.fixedExpense.delete({ where: { id: fixedExpenseId } })
  await prisma.financeSettings.deleteMany({ where: { id: 'singleton' } })
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } })
  await prisma.$disconnect()
})

describe('GET /finance/balance', () => {
  it('returns openingBalance 0 when no settings exist (ADMIN)', async () => {
    const res = await request(app).get('/finance/balance').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.openingBalance).toBe(0)
  })

  it('returns 403 for SALES', async () => {
    const res = await request(app).get('/finance/balance').set('Authorization', `Bearer ${salesToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 401 without token', async () => {
    const res = await request(app).get('/finance/balance')
    expect(res.status).toBe(401)
  })
})

describe('PUT /finance/balance', () => {
  it('sets openingBalance (FINANCE)', async () => {
    const res = await request(app)
      .put('/finance/balance')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ openingBalance: 100000 })
    expect(res.status).toBe(200)
    expect(res.body.openingBalance).toBe(100000)
  })

  it('returns 400 VALIDATION_ERROR for negative amount', async () => {
    const res = await request(app)
      .put('/finance/balance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ openingBalance: -1 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /finance/summary', () => {
  it('returns summary with balance, projected, installments, expenseLogs (ADMIN)', async () => {
    const now = new Date()
    const res = await request(app)
      .get(`/finance/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.balance).toBe('number')
    expect(typeof res.body.projected.incoming).toBe('number')
    expect(typeof res.body.projected.outgoing).toBe('number')
    expect(typeof res.body.projected.netProfit).toBe('number')
    expect(Array.isArray(res.body.installments)).toBe(true)
    expect(Array.isArray(res.body.expenseLogs)).toBe(true)
  })

  it('auto-creates FixedExpenseLog for active expenses in the month (idempotent)', async () => {
    const now = new Date()
    const params = `month=${now.getMonth() + 1}&year=${now.getFullYear()}`
    await request(app).get(`/finance/summary?${params}`).set('Authorization', `Bearer ${adminToken}`)
    await request(app).get(`/finance/summary?${params}`).set('Authorization', `Bearer ${adminToken}`)
    const logs = await prisma.fixedExpenseLog.findMany({
      where: { fixedExpenseId, month: now.getMonth() + 1, year: now.getFullYear() },
    })
    expect(logs).toHaveLength(1) // idempotent — no duplicates
  })

  it('returns 400 VALIDATION_ERROR for missing month', async () => {
    const res = await request(app)
      .get('/finance/summary?year=2026')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 for SALES', async () => {
    const res = await request(app)
      .get('/finance/summary?month=1&year=2026')
      .set('Authorization', `Bearer ${salesToken}`)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /finance/installments/:id/pay', () => {
  it('marks installment as PAID and creates CashTransaction (ADMIN)', async () => {
    const res = await request(app)
      .patch(`/finance/installments/${installmentId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PAID')
    expect(res.body.paidAt).toBeTruthy()
    const tx = await prisma.cashTransaction.findFirst({ where: { installmentId } })
    expect(tx).not.toBeNull()
    expect(tx!.type).toBe('INCOME')
    expect(tx!.amount).toBe(12000)
  })

  it('returns 400 ALREADY_PAID for already paid installment', async () => {
    const res = await request(app)
      .patch(`/finance/installments/${installmentId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ALREADY_PAID')
  })

  it('returns 404 for unknown installment', async () => {
    const res = await request(app)
      .patch('/finance/installments/nonexistent/pay')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /finance/expense-logs/:id/pay', () => {
  it('marks expense log as PAID and creates CashTransaction (FINANCE)', async () => {
    const res = await request(app)
      .patch(`/finance/expense-logs/${expenseLogId}/pay`)
      .set('Authorization', `Bearer ${financeToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('PAID')
    const tx = await prisma.cashTransaction.findFirst({ where: { fixedExpenseLogId: expenseLogId } })
    expect(tx).not.toBeNull()
    expect(tx!.type).toBe('EXPENSE')
    expect(tx!.amount).toBe(30000)
  })

  it('returns 400 ALREADY_PAID for already paid log', async () => {
    const res = await request(app)
      .patch(`/finance/expense-logs/${expenseLogId}/pay`)
      .set('Authorization', `Bearer ${financeToken}`)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('ALREADY_PAID')
  })

  it('returns 404 for unknown expense log', async () => {
    const res = await request(app)
      .patch('/finance/expense-logs/nonexistent/pay')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 4: Run routes test to verify it fails**

```bash
cd server && npx jest src/features/finance/finance.routes.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create types**

Create `server/src/features/finance/finance.types.ts`:

```ts
import { z } from 'zod'

export const summaryQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
})

export const updateBalanceSchema = z.object({
  openingBalance: z.number().int().min(0),
})

export type SummaryQuery = z.infer<typeof summaryQuerySchema>
export type UpdateBalanceInput = z.infer<typeof updateBalanceSchema>
```

- [ ] **Step 6: Create service**

Create `server/src/features/finance/finance.service.ts`:

```ts
import { TransactionType } from '@prisma/client'
import { prisma } from '../../lib/prisma'

// ─── Pure helper ──────────────────────────────────────────────────────────────

export function computeBalance(
  openingBalance: number,
  transactions: Array<{ type: TransactionType; amount: number }>,
): number {
  return transactions.reduce(
    (sum, t) => (t.type === 'INCOME' ? sum + t.amount : sum - t.amount),
    openingBalance,
  )
}

// ─── Balance ──────────────────────────────────────────────────────────────────

export async function getOpeningBalance(): Promise<number> {
  const settings = await prisma.financeSettings.findUnique({ where: { id: 'singleton' } })
  return settings?.openingBalance ?? 0
}

export async function updateOpeningBalance(openingBalance: number): Promise<number> {
  const settings = await prisma.financeSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', openingBalance },
    update: { openingBalance },
  })
  return settings.openingBalance
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getFinanceSummary(month: number, year: number) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 1)

  // Auto-upsert FixedExpenseLogs for all active expenses this month
  const activeExpenses = await prisma.fixedExpense.findMany({ where: { isActive: true } })
  for (const expense of activeExpenses) {
    await prisma.fixedExpenseLog.upsert({
      where: { fixedExpenseId_month_year: { fixedExpenseId: expense.id, month, year } },
      create: { fixedExpenseId: expense.id, month, year, status: 'PENDING' },
      update: {},
    })
  }

  // Balance: openingBalance + all transactions
  const openingBalance = await getOpeningBalance()
  const allTransactions = await prisma.cashTransaction.findMany({
    select: { type: true, amount: true },
  })
  const balance = computeBalance(openingBalance, allTransactions)

  // Installments due this month
  const installments = await prisma.installment.findMany({
    where: { dueDate: { gte: monthStart, lt: monthEnd } },
    include: {
      sale: {
        include: {
          quote: { include: { client: { select: { name: true } } } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  // Fixed expense logs for this month
  const expenseLogs = await prisma.fixedExpenseLog.findMany({
    where: { month, year },
    include: { fixedExpense: { select: { name: true, category: true, dueDay: true, amount: true } } },
    orderBy: { fixedExpense: { dueDay: 'asc' } },
  })

  // Projected values
  const incoming = installments
    .filter((i) => i.status === 'PENDING')
    .reduce((s, i) => s + i.amount, 0)
  const outgoing = expenseLogs
    .filter((l) => l.status === 'PENDING')
    .reduce((s, l) => s + l.fixedExpense.amount, 0)

  // Net profit: paid transactions this month
  const monthTransactions = await prisma.cashTransaction.findMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
    select: { type: true, amount: true },
  })
  const paidIncome = monthTransactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0)
  const paidExpense = monthTransactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0)
  const netProfit = paidIncome - paidExpense

  return {
    balance,
    openingBalance,
    month,
    year,
    projected: { incoming, outgoing, netProfit },
    installments: installments.map((i) => ({
      id: i.id,
      dueDate: i.dueDate.toISOString().slice(0, 10),
      amount: i.amount,
      status: i.status,
      clientName: i.sale.quote.client.name,
      quoteId: i.sale.quote.id,
    })),
    expenseLogs: expenseLogs.map((l) => ({
      id: l.id,
      fixedExpenseName: l.fixedExpense.name,
      category: l.fixedExpense.category,
      dueDay: l.fixedExpense.dueDay,
      amount: l.fixedExpense.amount,
      status: l.status,
    })),
  }
}

// ─── Pay installment ──────────────────────────────────────────────────────────

export async function payInstallment(id: string) {
  const installment = await prisma.installment.findUnique({
    where: { id },
    include: {
      sale: { include: { quote: { include: { client: { select: { name: true } } } } } },
    },
  })
  if (!installment) return { error: 'NOT_FOUND' as const }
  if (installment.status === 'PAID') return { error: 'ALREADY_PAID' as const }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.installment.update({ where: { id }, data: { status: 'PAID', paidAt: now } })
    await tx.cashTransaction.create({
      data: {
        type: 'INCOME',
        amount: installment.amount,
        date: now,
        origin: 'INSTALLMENT',
        description: installment.sale.quote.client.name,
        installmentId: id,
      },
    })
  })

  const updated = await prisma.installment.findUnique({ where: { id } })
  return { installment: updated }
}

// ─── Pay expense log ──────────────────────────────────────────────────────────

export async function payExpenseLog(id: string) {
  const log = await prisma.fixedExpenseLog.findUnique({
    where: { id },
    include: { fixedExpense: { select: { name: true, amount: true } } },
  })
  if (!log) return { error: 'NOT_FOUND' as const }
  if (log.status === 'PAID') return { error: 'ALREADY_PAID' as const }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.fixedExpenseLog.update({ where: { id }, data: { status: 'PAID', paidAt: now } })
    await tx.cashTransaction.create({
      data: {
        type: 'EXPENSE',
        amount: log.fixedExpense.amount,
        date: now,
        origin: 'FIXED_EXPENSE',
        description: log.fixedExpense.name,
        fixedExpenseLogId: id,
      },
    })
  })

  const updated = await prisma.fixedExpenseLog.findUnique({ where: { id } })
  return { log: updated }
}
```

- [ ] **Step 7: Create controller**

Create `server/src/features/finance/finance.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import {
  getOpeningBalance,
  updateOpeningBalance,
  getFinanceSummary,
  payInstallment,
  payExpenseLog,
} from './finance.service'
import { summaryQuerySchema, updateBalanceSchema } from './finance.types'

export async function handleGetBalance(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const openingBalance = await getOpeningBalance()
    res.json({ openingBalance })
  } catch (err) {
    next(err)
  }
}

export async function handleUpdateBalance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateBalanceSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const openingBalance = await updateOpeningBalance(parsed.data.openingBalance)
    res.json({ openingBalance })
  } catch (err) {
    next(err)
  }
}

export async function handleGetSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = summaryQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' })
      return
    }
    const summary = await getFinanceSummary(parsed.data.month, parsed.data.year)
    res.json(summary)
  } catch (err) {
    next(err)
  }
}

export async function handlePayInstallment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await payInstallment(req.params.id as string)
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Installment not found', code: 'NOT_FOUND' })
      } else {
        res.status(400).json({ error: 'Installment already paid', code: 'ALREADY_PAID' })
      }
      return
    }
    res.json(result.installment)
  } catch (err) {
    next(err)
  }
}

export async function handlePayExpenseLog(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await payExpenseLog(req.params.id as string)
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Expense log not found', code: 'NOT_FOUND' })
      } else {
        res.status(400).json({ error: 'Expense log already paid', code: 'ALREADY_PAID' })
      }
      return
    }
    res.json(result.log)
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 8: Create routes**

Create `server/src/features/finance/finance.routes.ts`:

```ts
import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate'
import { authorize } from '../../middlewares/authorize'
import {
  handleGetBalance,
  handleUpdateBalance,
  handleGetSummary,
  handlePayInstallment,
  handlePayExpenseLog,
} from './finance.controller'

export const financeRouter = Router()

financeRouter.use(authenticate, authorize('ADMIN', 'FINANCE'))

financeRouter.get('/balance', handleGetBalance)
financeRouter.put('/balance', handleUpdateBalance)
financeRouter.get('/summary', handleGetSummary)
financeRouter.patch('/installments/:id/pay', handlePayInstallment)
financeRouter.patch('/expense-logs/:id/pay', handlePayExpenseLog)
```

- [ ] **Step 9: Run all finance tests**

```bash
cd server && npx jest src/features/finance/ --no-coverage
```

Expected: all tests PASS (both service.test.ts and routes.test.ts).

- [ ] **Step 10: Commit**

```bash
git add server/src/features/finance/
git commit -m "feat(server): add finance feature (summary, balance, pay installment/expense-log)"
```

---

### Task 4: Register new routers in app.ts

**Files:**
- Modify: `server/src/app.ts`

- [ ] **Step 1: Add imports and mount routes**

Open `server/src/app.ts` and replace the entire file content with:

```ts
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
import { fixedExpensesRouter } from './features/fixed-expenses/fixed-expenses.routes'
import { financeRouter } from './features/finance/finance.routes'
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
app.use('/fixed-expenses', fixedExpensesRouter)
app.use('/finance', financeRouter)

// Centralized error handler — must be last
app.use(errorHandler)

export default app
```

- [ ] **Step 2: Run all server tests to verify nothing broke**

```bash
cd server && npx jest --no-coverage
```

Expected: all test suites PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/app.ts
git commit -m "feat(server): register financeRouter and fixedExpensesRouter in app"
```

---

### Task 5: Fixed expenses client feature

**Files:**
- Create: `client/src/features/fixed-expenses/types.ts`
- Create: `client/src/features/fixed-expenses/api.ts`
- Create: `client/src/features/fixed-expenses/hooks.ts`
- Create: `client/src/features/fixed-expenses/FixedExpensesListPage.tsx`
- Create: `client/src/features/fixed-expenses/FixedExpenseFormPage.tsx`

- [ ] **Step 1: Create types**

Create `client/src/features/fixed-expenses/types.ts`:

```ts
export interface FixedExpense {
  id: string
  name: string
  amount: number
  dueDay: number
  category: string | null
  isActive: boolean
}

export interface CreateFixedExpensePayload {
  name: string
  amount: number
  dueDay: number
  category?: string
}

export type UpdateFixedExpensePayload = Partial<CreateFixedExpensePayload>
```

- [ ] **Step 2: Create api**

Create `client/src/features/fixed-expenses/api.ts`:

```ts
import { api } from '@/lib/axios'
import type { FixedExpense, CreateFixedExpensePayload, UpdateFixedExpensePayload } from './types'

export async function listFixedExpenses(): Promise<FixedExpense[]> {
  const { data } = await api.get<FixedExpense[]>('/fixed-expenses')
  return data
}

export async function getFixedExpense(id: string): Promise<FixedExpense> {
  const { data } = await api.get<FixedExpense>(`/fixed-expenses/${id}`)
  return data
}

export async function createFixedExpense(payload: CreateFixedExpensePayload): Promise<FixedExpense> {
  const { data } = await api.post<FixedExpense>('/fixed-expenses', payload)
  return data
}

export async function updateFixedExpense(
  id: string,
  payload: UpdateFixedExpensePayload,
): Promise<FixedExpense> {
  const { data } = await api.put<FixedExpense>(`/fixed-expenses/${id}`, payload)
  return data
}

export async function deleteFixedExpense(id: string): Promise<void> {
  await api.delete(`/fixed-expenses/${id}`)
}
```

- [ ] **Step 3: Create hooks**

Create `client/src/features/fixed-expenses/hooks.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listFixedExpenses,
  getFixedExpense,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
} from './api'
import type { CreateFixedExpensePayload, UpdateFixedExpensePayload } from './types'

export function useFixedExpenses() {
  return useQuery({ queryKey: ['fixed-expenses'], queryFn: listFixedExpenses })
}

export function useFixedExpense(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['fixed-expenses', id],
    queryFn: () => getFixedExpense(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateFixedExpensePayload) => createFixedExpense(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-expenses'] }),
  })
}

export function useUpdateFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFixedExpensePayload }) =>
      updateFixedExpense(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-expenses'] }),
  })
}

export function useDeleteFixedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFixedExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-expenses'] }),
  })
}
```

- [ ] **Step 4: Create list page**

Create `client/src/features/fixed-expenses/FixedExpensesListPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useFixedExpenses, useDeleteFixedExpense } from './hooks'
import { formatCurrency } from '@/lib/format'

export function FixedExpensesListPage() {
  const { data: expenses, isLoading, error } = useFixedExpenses()
  const deleteMutation = useDeleteFixedExpense()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar despesas fixas.</p>

  async function handleDelete(id: string) {
    if (!confirm('Desativar esta despesa fixa?')) return
    setDeletingId(id)
    try {
      await deleteMutation.mutateAsync(id)
    } finally {
      setDeletingId(null)
    }
  }

  const btnStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>Despesas Fixas</h1>
        <Link to="/fixed-expenses/new">
          <button
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Nova Despesa
          </button>
        </Link>
      </div>
      {expenses?.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)' }}>Nenhuma despesa fixa cadastrada.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-200)', textAlign: 'left' }}>
              {['Nome', 'Categoria', 'Dia Venc.', 'Valor', 'Ações'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expenses?.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
                <td style={{ padding: '8px 12px' }}>{e.name}</td>
                <td style={{ padding: '8px 12px', color: 'var(--color-neutral-600)' }}>
                  {e.category ?? '—'}
                </td>
                <td style={{ padding: '8px 12px' }}>Dia {e.dueDay}</td>
                <td style={{ padding: '8px 12px' }}>{formatCurrency(e.amount)}</td>
                <td style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
                  <Link to="/fixed-expenses/$id/edit" params={{ id: e.id }}>
                    <button style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}>
                      Editar
                    </button>
                  </Link>
                  <button
                    style={{ ...btnStyle, background: 'var(--color-danger)', color: '#fff', opacity: deletingId === e.id ? 0.6 : 1 }}
                    disabled={deletingId === e.id}
                    onClick={() => void handleDelete(e.id)}
                  >
                    Desativar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create form page**

Create `client/src/features/fixed-expenses/FixedExpenseFormPage.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useFixedExpense, useCreateFixedExpense, useUpdateFixedExpense } from './hooks'

type FormState = {
  name: string
  amountBrl: string
  dueDay: string
  category: string
}

const empty: FormState = { name: '', amountBrl: '', dueDay: '1', category: '' }

export function FixedExpenseFormPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id
  const isEdit = Boolean(id)

  const { data: existing } = useFixedExpense(id ?? '', { enabled: isEdit })
  const createMutation = useCreateFixedExpense()
  const updateMutation = useUpdateFixedExpense()

  const [form, setForm] = useState<FormState>(empty)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        amountBrl: (existing.amount / 100).toFixed(2),
        dueDay: String(existing.dueDay),
        category: existing.category ?? '',
      })
    } else if (!isEdit) {
      setForm(empty)
      setServerError(null)
    }
  }, [existing, isEdit])

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const amount = Math.round(parseFloat(form.amountBrl) * 100)
    const dueDay = parseInt(form.dueDay, 10)
    if (isNaN(amount) || amount <= 0) {
      setServerError('Valor inválido.')
      return
    }
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) {
      setServerError('Dia de vencimento deve ser entre 1 e 28.')
      return
    }
    const payload = {
      name: form.name,
      amount,
      dueDay,
      ...(form.category && { category: form.category }),
    }
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      void navigate({ to: '/fixed-expenses' })
    } catch {
      setServerError('Erro ao salvar. Verifique os dados.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-1) var(--space-2)',
    border: '1px solid var(--color-neutral-300)',
    borderRadius: 4,
    fontSize: '1rem',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 4,
    fontWeight: 600,
    fontSize: '0.875rem',
  }
  const fieldStyle: React.CSSProperties = { marginBottom: 'var(--space-3)' }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>
        {isEdit ? 'Editar Despesa Fixa' : 'Nova Despesa Fixa'}
      </h1>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Nome *</label>
          <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Valor (R$) *</label>
          <input
            style={inputStyle}
            type="number"
            step="0.01"
            min="0.01"
            value={form.amountBrl}
            onFocus={(e) => e.target.select()}
            onChange={(e) => set('amountBrl', e.target.value)}
            required
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Dia de Vencimento (1–28) *</label>
          <input
            style={inputStyle}
            type="number"
            min="1"
            max="28"
            value={form.dueDay}
            onChange={(e) => set('dueDay', e.target.value)}
            required
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Categoria</label>
          <input style={inputStyle} value={form.category} onChange={(e) => set('category', e.target.value)} />
        </div>
        {serverError && (
          <p style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>{serverError}</p>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            type="submit"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isEdit ? 'Salvar' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/fixed-expenses' })}
            style={{
              background: 'var(--color-neutral-200)',
              color: 'var(--color-neutral-900)',
              border: 'none',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
/c/freela/constru-manager/client/node_modules/.bin/tsc --noEmit --project /c/freela/constru-manager/client/tsconfig.json
```

Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add client/src/features/fixed-expenses/
git commit -m "feat(client): add fixed-expenses feature (types, api, hooks, list page, form page)"
```

---

### Task 6: Finance dashboard client feature

**Files:**
- Create: `client/src/features/finance/types.ts`
- Create: `client/src/features/finance/api.ts`
- Create: `client/src/features/finance/hooks.ts`
- Create: `client/src/features/finance/FinanceDashboardPage.tsx`

- [ ] **Step 1: Create types**

Create `client/src/features/finance/types.ts`:

```ts
export interface InstallmentSummaryItem {
  id: string
  dueDate: string
  amount: number
  status: 'PENDING' | 'PAID' | 'OVERDUE'
  clientName: string
  quoteId: string
}

export interface ExpenseLogSummaryItem {
  id: string
  fixedExpenseName: string
  category: string | null
  dueDay: number
  amount: number
  status: 'PENDING' | 'PAID'
}

export interface FinanceSummary {
  balance: number
  openingBalance: number
  month: number
  year: number
  projected: {
    incoming: number
    outgoing: number
    netProfit: number
  }
  installments: InstallmentSummaryItem[]
  expenseLogs: ExpenseLogSummaryItem[]
}
```

- [ ] **Step 2: Create api**

Create `client/src/features/finance/api.ts`:

```ts
import { api } from '@/lib/axios'
import type { FinanceSummary } from './types'

export async function getFinanceSummary(month: number, year: number): Promise<FinanceSummary> {
  const { data } = await api.get<FinanceSummary>(`/finance/summary?month=${month}&year=${year}`)
  return data
}

export async function getBalance(): Promise<{ openingBalance: number }> {
  const { data } = await api.get<{ openingBalance: number }>('/finance/balance')
  return data
}

export async function updateBalance(openingBalance: number): Promise<{ openingBalance: number }> {
  const { data } = await api.put<{ openingBalance: number }>('/finance/balance', { openingBalance })
  return data
}

export async function payInstallment(id: string): Promise<void> {
  await api.patch(`/finance/installments/${id}/pay`)
}

export async function payExpenseLog(id: string): Promise<void> {
  await api.patch(`/finance/expense-logs/${id}/pay`)
}
```

- [ ] **Step 3: Create hooks**

Create `client/src/features/finance/hooks.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getFinanceSummary, updateBalance, payInstallment, payExpenseLog } from './api'

export function useFinanceSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['finance', 'summary', month, year],
    queryFn: () => getFinanceSummary(month, year),
  })
}

export function useUpdateOpeningBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (openingBalance: number) => updateBalance(openingBalance),
    onSuccess: (_, __, _ctx) => qc.invalidateQueries({ queryKey: ['finance', 'summary'] }),
  })
}

export function usePayInstallment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => payInstallment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'summary'] }),
  })
}

export function usePayExpenseLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => payExpenseLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'summary'] }),
  })
}
```

- [ ] **Step 4: Create dashboard page**

Create `client/src/features/finance/FinanceDashboardPage.tsx`:

```tsx
import { useState } from 'react'
import { useFinanceSummary, useUpdateOpeningBalance, usePayInstallment, usePayExpenseLog } from './hooks'
import { formatCurrency } from '@/lib/format'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--color-warning, #f59e0b)',
  PAID: 'var(--color-success, #16a34a)',
  OVERDUE: 'var(--color-danger)',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
}

export function FinanceDashboardPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceInput, setBalanceInput] = useState('')

  const { data, isLoading, error } = useFinanceSummary(month, year)
  const updateBalance = useUpdateOpeningBalance()
  const payInstallment = usePayInstallment()
  const payExpenseLog = usePayExpenseLog()

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  async function handleSaveBalance() {
    const value = Math.round(parseFloat(balanceInput) * 100)
    if (isNaN(value) || value < 0) return
    await updateBalance.mutateAsync(value)
    setEditingBalance(false)
  }

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>
  if (error || !data) return <p style={{ color: 'var(--color-danger)' }}>Erro ao carregar dados financeiros.</p>

  const cardBase: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-neutral-200)',
    borderRadius: 8,
    padding: 'var(--space-3)',
  }

  const btnStyle: React.CSSProperties = {
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
  }

  return (
    <div>
      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Financeiro</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button onClick={prevMonth} style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}>{'<'}</button>
          <span style={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}>{'>'}</button>
        </div>
      </div>

      {/* Balance card */}
      <div style={{ ...cardBase, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Saldo em Caixa</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatCurrency(data.balance)}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>
            Saldo inicial: {formatCurrency(data.openingBalance)}
          </p>
        </div>
        {editingBalance ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              onFocus={(e) => e.target.select()}
              style={{ padding: '6px 8px', border: '1px solid var(--color-neutral-300)', borderRadius: 4, width: 140 }}
              placeholder="Ex: 5000.00"
            />
            <button onClick={() => void handleSaveBalance()} style={{ ...btnStyle, background: 'var(--color-primary)', color: '#fff' }}>
              Salvar
            </button>
            <button onClick={() => setEditingBalance(false)} style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}>
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setBalanceInput((data.openingBalance / 100).toFixed(2)); setEditingBalance(true) }}
            style={{ ...btnStyle, background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}
          >
            Editar saldo inicial
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <div style={cardBase}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Previsto Entrar</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success, #16a34a)' }}>
            {formatCurrency(data.projected.incoming)}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>Parcelas pendentes no mês</p>
        </div>
        <div style={cardBase}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Previsto Sair</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>
            {formatCurrency(data.projected.outgoing)}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>Despesas fixas pendentes</p>
        </div>
        <div style={cardBase}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-neutral-600)', marginBottom: 4 }}>Lucro Líquido</p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: data.projected.netProfit >= 0 ? 'var(--color-success, #16a34a)' : 'var(--color-danger)' }}>
            {formatCurrency(data.projected.netProfit)}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-500)' }}>Entradas pagas − saídas pagas</p>
        </div>
      </div>

      {/* Installments table */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Parcelas do Mês</h2>
      {data.installments.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)', marginBottom: 'var(--space-4)' }}>Nenhuma parcela neste mês.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-4)' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-200)', textAlign: 'left' }}>
              {['Cliente', 'Vencimento', 'Valor', 'Status', 'Ação'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.installments.map((inst) => (
              <tr key={inst.id} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
                <td style={{ padding: '8px 12px' }}>{inst.clientName}</td>
                <td style={{ padding: '8px 12px' }}>{inst.dueDate}</td>
                <td style={{ padding: '8px 12px' }}>{formatCurrency(inst.amount)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ color: STATUS_COLOR[inst.status], fontWeight: 600, fontSize: '0.85rem' }}>
                    {STATUS_LABEL[inst.status]}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {inst.status === 'PENDING' && (
                    <button
                      onClick={() => void payInstallment.mutateAsync(inst.id)}
                      disabled={payInstallment.isPending}
                      style={{ ...btnStyle, background: 'var(--color-primary)', color: '#fff' }}
                    >
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Expense logs table */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Despesas Fixas do Mês</h2>
      {data.expenseLogs.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-600)' }}>Nenhuma despesa fixa ativa.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-200)', textAlign: 'left' }}>
              {['Despesa', 'Categoria', 'Dia', 'Valor', 'Status', 'Ação'].map((h) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.expenseLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--color-neutral-200)' }}>
                <td style={{ padding: '8px 12px' }}>{log.fixedExpenseName}</td>
                <td style={{ padding: '8px 12px', color: 'var(--color-neutral-600)' }}>{log.category ?? '—'}</td>
                <td style={{ padding: '8px 12px' }}>Dia {log.dueDay}</td>
                <td style={{ padding: '8px 12px' }}>{formatCurrency(log.amount)}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ color: STATUS_COLOR[log.status], fontWeight: 600, fontSize: '0.85rem' }}>
                    {STATUS_LABEL[log.status]}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {log.status === 'PENDING' && (
                    <button
                      onClick={() => void payExpenseLog.mutateAsync(log.id)}
                      disabled={payExpenseLog.isPending}
                      style={{ ...btnStyle, background: 'var(--color-danger)', color: '#fff' }}
                    >
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
/c/freela/constru-manager/client/node_modules/.bin/tsc --noEmit --project /c/freela/constru-manager/client/tsconfig.json
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add client/src/features/finance/
git commit -m "feat(client): add finance dashboard feature (types, api, hooks, dashboard page)"
```

---

### Task 7: Router + sidebar

**Files:**
- Modify: `client/src/router/index.tsx`
- Modify: `client/src/layouts/AppLayout.tsx`

- [ ] **Step 1: Add routes to router**

Open `client/src/router/index.tsx`. Add these imports after the existing feature imports:

```ts
import { FixedExpensesListPage } from '@/features/fixed-expenses/FixedExpensesListPage'
import { FixedExpenseFormPage } from '@/features/fixed-expenses/FixedExpenseFormPage'
import { FinanceDashboardPage } from '@/features/finance/FinanceDashboardPage'
```

Add these route definitions after the `quoteAddVersionRoute` definition:

```ts
const fixedExpensesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/fixed-expenses',
  component: FixedExpensesListPage,
})

const fixedExpenseCreateRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/fixed-expenses/new',
  component: FixedExpenseFormPage,
})

const fixedExpenseEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/fixed-expenses/$id/edit',
  component: FixedExpenseFormPage,
})

const financeDashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/finance',
  component: FinanceDashboardPage,
})
```

Update the `routeTree` to include the new routes:

```ts
const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    indexRoute,
    clientsRoute,
    clientCreateRoute,
    clientEditRoute,
    productsRoute,
    productCreateRoute,
    productEditRoute,
    kitsRoute,
    kitCreateRoute,
    kitEditRoute,
    quotesRoute,
    quoteCreateRoute,
    quoteDetailRoute,
    quoteAddVersionRoute,
    fixedExpensesRoute,
    fixedExpenseCreateRoute,
    fixedExpenseEditRoute,
    financeDashboardRoute,
  ]),
])
```

- [ ] **Step 2: Add nav links to sidebar**

Open `client/src/layouts/AppLayout.tsx`. After the `Orçamentos` nav item (around line 74), add:

```tsx
{(user?.role === 'ADMIN' || user?.role === 'FINANCE') && (
  <li>
    <Link to="/finance" style={linkStyle}>
      Financeiro
    </Link>
  </li>
)}
{(user?.role === 'ADMIN' || user?.role === 'FINANCE') && (
  <li>
    <Link to="/fixed-expenses" style={linkStyle}>
      Despesas Fixas
    </Link>
  </li>
)}
```

- [ ] **Step 3: Verify TypeScript**

```bash
/c/freela/constru-manager/client/node_modules/.bin/tsc --noEmit --project /c/freela/constru-manager/client/tsconfig.json
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add client/src/router/index.tsx client/src/layouts/AppLayout.tsx
git commit -m "feat(client): add finance and fixed-expenses routes and sidebar links"
```
