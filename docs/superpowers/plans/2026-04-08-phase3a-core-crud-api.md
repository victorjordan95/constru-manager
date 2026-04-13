# Phase 3a — Core CRUD API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CRUD API endpoints for Clients, Products, and Kits with proper authentication, RBAC, Zod validation, and integration tests hitting the real database.

**Architecture:** Feature-based structure mirroring Phase 2 (`auth`). Each feature has: types (Zod schemas), service (pure DB calls), controller (HTTP handlers), routes (middleware wiring), and integration tests. Products auto-compute `finalPrice = Math.round(basePrice × (1 + markupPercent/100))`. Kits auto-compute `totalPrice` from `sum(product.finalPrice × quantity)` for each item, replacing all items on update. No new DB migrations — Phase 1 already defines all models.

**Tech Stack:** Express, Prisma (singleton `lib/prisma.ts`), Zod, supertest (integration tests), Jest

---

## Scope note

Phase 3 per spec covers "API + frontend pages." This plan covers only the API (server). Phase 3b (React pages, routing, auth store, API hooks) is a separate plan.

---

## File Map

```
server/src/
├── app.ts                                    ← modify: mount /clients, /products, /kits routers
└── features/
    ├── clients/
    │   ├── clients.types.ts                  ← new: Zod schemas + TS types
    │   ├── clients.service.ts                ← new: list, get, create, update, softDelete
    │   ├── clients.controller.ts             ← new: HTTP handlers (delegates to service)
    │   ├── clients.routes.ts                 ← new: router with authenticate + authorize
    │   └── clients.routes.test.ts            ← new: integration tests (real DB)
    ├── products/
    │   ├── products.types.ts                 ← new: Zod schemas + TS types
    │   ├── products.service.ts               ← new: computeFinalPrice + DB operations
    │   ├── products.service.test.ts          ← new: unit tests for computeFinalPrice (no DB)
    │   ├── products.controller.ts            ← new: HTTP handlers
    │   ├── products.routes.ts                ← new: router with authenticate + authorize
    │   └── products.routes.test.ts           ← new: integration tests (real DB)
    └── kits/
        ├── kits.types.ts                     ← new: Zod schemas + TS types
        ├── kits.service.ts                   ← new: computeKitTotalPriceFromMap + DB operations
        ├── kits.service.test.ts              ← new: unit tests for computeKitTotalPriceFromMap (no DB)
        ├── kits.controller.ts                ← new: HTTP handlers
        ├── kits.routes.ts                    ← new: ADMIN-only router
        └── kits.routes.test.ts               ← new: integration tests (real DB)
```

---

## Endpoints Implemented

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | /clients | SALES, ADMIN | List active clients, newest first |
| POST | /clients | SALES, ADMIN | Create client |
| GET | /clients/:id | SALES, ADMIN | Get one active client |
| PUT | /clients/:id | SALES, ADMIN | Update client fields |
| DELETE | /clients/:id | ADMIN | Soft delete (sets isActive = false) |
| GET | /products | SALES, ADMIN | List active products, A-Z |
| POST | /products | ADMIN | Create product (finalPrice auto-computed) |
| PUT | /products/:id | ADMIN | Update product (finalPrice recomputed) |
| DELETE | /products/:id | ADMIN | Soft delete |
| GET | /kits | ADMIN | List active kits with items |
| POST | /kits | ADMIN | Create kit with items (totalPrice auto-computed) |
| PUT | /kits/:id | ADMIN | Update name/items (totalPrice recomputed, items replaced) |

---

## Error Codes

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod parse failure |
| `INVALID_PRODUCT` | 400 | Kit references non-existent or inactive product |
| `DUPLICATE_TAX_ID` | 409 | Client taxId already exists |
| `NOT_FOUND` | 404 | Resource not found or is soft-deleted |
| `UNAUTHORIZED` | 401 | No / invalid Bearer token (from authenticate middleware) |
| `FORBIDDEN` | 403 | Valid token but wrong role (from authorize middleware) |

---

## Task 1: Clients — Types

**Files:**
- Create: `server/src/features/clients/clients.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// server/src/features/clients/clients.types.ts
import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
  nationalId: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd server && npx tsc --noEmit`
Expected: no errors

---

## Task 2: Clients — Write Failing Integration Tests

**Files:**
- Create: `server/src/features/clients/clients.routes.test.ts`

- [ ] **Step 1: Write the integration tests**

```typescript
// server/src/features/clients/clients.routes.test.ts
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

beforeAll(async () => {
  const pw = await hashPassword('TestPass123!');
  await prisma.user.createMany({
    data: [
      { email: ADMIN_EMAIL, passwordHash: pw, role: 'ADMIN' },
      { email: SALES_EMAIL, passwordHash: pw, role: 'SALES' },
      { email: FINANCE_EMAIL, passwordHash: pw, role: 'FINANCE' },
    ],
  });
  const users = await prisma.user.findMany({
    where: { email: { in: [ADMIN_EMAIL, SALES_EMAIL, FINANCE_EMAIL] } },
    select: { id: true, email: true, role: true },
  });
  const byEmail = Object.fromEntries(users.map(u => [u.email, u]));
  adminToken = signAccessToken({ userId: byEmail[ADMIN_EMAIL].id, role: byEmail[ADMIN_EMAIL].role });
  salesToken = signAccessToken({ userId: byEmail[SALES_EMAIL].id, role: byEmail[SALES_EMAIL].role });
  financeToken = signAccessToken({ userId: byEmail[FINANCE_EMAIL].id, role: byEmail[FINANCE_EMAIL].role });
});

afterAll(async () => {
  await prisma.client.deleteMany({ where: { taxId: { startsWith: UNIQUE } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
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
    const c = await prisma.client.create({ data: { name: 'Lookup Corp', taxId: `${UNIQUE}-get` } });
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
    const c = await prisma.client.create({ data: { name: 'Old Name', taxId: `${UNIQUE}-put` } });
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
    const c = await prisma.client.create({ data: { name: 'To Delete', taxId: `${UNIQUE}-del` } });
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
    const c = await prisma.client.create({ data: { name: 'Protected', taxId: `${UNIQUE}-del2` } });
    const res = await request(app)
      .delete(`/clients/${c.id}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd server && npx jest features/clients --no-coverage`
Expected: FAIL — all requests return 404 (routes not mounted yet)

---

## Task 3: Clients — Service

**Files:**
- Create: `server/src/features/clients/clients.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// server/src/features/clients/clients.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateClientInput, UpdateClientInput } from './clients.types';

export function listClients() {
  return prisma.client.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function getClientById(id: string) {
  return prisma.client.findFirst({ where: { id, isActive: true } });
}

export function createClient(data: CreateClientInput) {
  return prisma.client.create({ data });
}

export async function updateClient(id: string, data: UpdateClientInput) {
  try {
    return await prisma.client.update({ where: { id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return null;
    }
    throw err;
  }
}

export async function softDeleteClient(id: string): Promise<boolean> {
  try {
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return false;
    }
    throw err;
  }
}
```

---

## Task 4: Clients — Controller

**Files:**
- Create: `server/src/features/clients/clients.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// server/src/features/clients/clients.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import {
  listClients,
  getClientById,
  createClient,
  updateClient,
  softDeleteClient,
} from './clients.service';
import { createClientSchema, updateClientSchema } from './clients.types';

export async function handleListClients(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listClients());
  } catch (err) {
    next(err);
  }
}

export async function handleGetClientById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const client = await getClientById(req.params.id);
    if (!client) {
      res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function handleCreateClient(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    res.status(201).json(await createClient(parsed.data));
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      res.status(409).json({ error: 'Tax ID already in use', code: 'DUPLICATE_TAX_ID' });
      return;
    }
    next(err);
  }
}

export async function handleUpdateClient(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const client = await updateClient(req.params.id, parsed.data);
    if (!client) {
      res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteClient(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ok = await softDeleteClient(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

---

## Task 5: Clients — Router + Mount + Verify

**Files:**
- Create: `server/src/features/clients/clients.routes.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create the router**

```typescript
// server/src/features/clients/clients.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleListClients,
  handleGetClientById,
  handleCreateClient,
  handleUpdateClient,
  handleDeleteClient,
} from './clients.controller';

export const clientsRouter = Router();

clientsRouter.use(authenticate);

clientsRouter.get('/', authorize('SALES', 'ADMIN'), handleListClients);
clientsRouter.post('/', authorize('SALES', 'ADMIN'), handleCreateClient);
clientsRouter.get('/:id', authorize('SALES', 'ADMIN'), handleGetClientById);
clientsRouter.put('/:id', authorize('SALES', 'ADMIN'), handleUpdateClient);
clientsRouter.delete('/:id', authorize('ADMIN'), handleDeleteClient);
```

- [ ] **Step 2: Mount in app.ts**

Add this import after the existing feature imports in `server/src/app.ts`:
```typescript
import { clientsRouter } from './features/clients/clients.routes';
```

Add this route mount after `app.use('/auth', authRouter)`:
```typescript
app.use('/clients', clientsRouter);
```

- [ ] **Step 3: Run clients tests — verify they pass**

Run: `cd server && npx jest features/clients --no-coverage`
Expected: all tests PASS

- [ ] **Step 4: Run all tests — verify nothing regressed**

Run: `cd server && npx jest --no-coverage`
Expected: all tests PASS (34 existing + new clients tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/features/clients/ server/src/app.ts
git commit -m "feat: add clients CRUD API (GET, POST, GET/:id, PUT/:id, DELETE/:id)"
```

---

## Task 6: Products — Types

**Files:**
- Create: `server/src/features/products/products.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// server/src/features/products/products.types.ts
import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  basePrice: z.number().int().min(0, 'basePrice must be a non-negative integer (cents)'),
  markupPercent: z.number().min(0).max(99999.99),
  unit: z.string().optional(),
  minStock: z.number().int().min(0).optional(),
});

// stockQty is managed by inventory (Phase 7), not editable here
// finalPrice is auto-computed, not accepted from client
export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
```

---

## Task 7: Products — Service (TDD: Unit Test First)

**Files:**
- Create: `server/src/features/products/products.service.test.ts`
- Create: `server/src/features/products/products.service.ts`

- [ ] **Step 1: Write the failing unit test**

```typescript
// server/src/features/products/products.service.test.ts
import { computeFinalPrice } from './products.service';

describe('computeFinalPrice', () => {
  it('applies markup to base price in cents', () => {
    // 100.00 (10000 cents) + 20% = 120.00 (12000 cents)
    expect(computeFinalPrice(10000, 20)).toBe(12000);
  });

  it('returns base price unchanged when markup is 0', () => {
    expect(computeFinalPrice(5000, 0)).toBe(5000);
  });

  it('rounds to nearest cent', () => {
    // 99.99 (9999 cents) + 10% = 109.989 → rounds to 10999
    expect(computeFinalPrice(9999, 10)).toBe(10999);
  });

  it('handles 100% markup (double price)', () => {
    expect(computeFinalPrice(10000, 100)).toBe(20000);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd server && npx jest products.service.test --no-coverage`
Expected: FAIL — `Cannot find module './products.service'`

- [ ] **Step 3: Create the service**

```typescript
// server/src/features/products/products.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateProductInput, UpdateProductInput } from './products.types';

export function computeFinalPrice(basePrice: number, markupPercent: number): number {
  return Math.round(basePrice * (1 + markupPercent / 100));
}

export function listProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export function createProduct(data: CreateProductInput) {
  const finalPrice = computeFinalPrice(data.basePrice, data.markupPercent);
  return prisma.product.create({
    data: {
      name: data.name,
      basePrice: data.basePrice,
      markupPercent: data.markupPercent,
      finalPrice,
      unit: data.unit,
      minStock: data.minStock,
      stockQty: 0,
    },
  });
}

export async function updateProduct(id: string, data: UpdateProductInput) {
  const current = await prisma.product.findUnique({ where: { id } });
  if (!current) return null;

  const basePrice = data.basePrice ?? current.basePrice;
  const markupPercent =
    data.markupPercent !== undefined ? data.markupPercent : current.markupPercent.toNumber();
  const finalPrice = computeFinalPrice(basePrice, markupPercent);

  try {
    return await prisma.product.update({
      where: { id },
      data: { ...data, markupPercent, finalPrice },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return null;
    }
    throw err;
  }
}

export async function softDeleteProduct(id: string): Promise<boolean> {
  try {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return false;
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run unit tests — verify they pass**

Run: `cd server && npx jest products.service.test --no-coverage`
Expected: all 4 tests PASS

---

## Task 8: Products — Write Failing Integration Tests

**Files:**
- Create: `server/src/features/products/products.routes.test.ts`

- [ ] **Step 1: Write the integration tests**

```typescript
// server/src/features/products/products.routes.test.ts
import request from 'supertest';
import app from '../../app';
import { prisma } from '../../lib/prisma';
import { hashPassword, signAccessToken } from '../auth/auth.service';

const UNIQUE = `p3-products-${Date.now()}`;
const ADMIN_EMAIL = `${UNIQUE}-admin@test.com`;
const SALES_EMAIL = `${UNIQUE}-sales@test.com`;

let adminToken: string;
let salesToken: string;

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
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { name: { startsWith: UNIQUE } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: UNIQUE } } });
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
      },
    });
    productId = p.id;
  });

  it('soft-deletes product (isActive = false) and returns 204', async () => {
    const res = await request(app)
      .delete(`/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    // Verify isActive is now false in DB
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
      },
    });
    const res = await request(app)
      .delete(`/products/${p.id}`)
      .set('Authorization', `Bearer ${salesToken}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd server && npx jest features/products/products.routes --no-coverage`
Expected: FAIL — all requests return 404 (routes not mounted yet)

---

## Task 9: Products — Controller

**Files:**
- Create: `server/src/features/products/products.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// server/src/features/products/products.controller.ts
import { Request, Response, NextFunction } from 'express';
import { listProducts, createProduct, updateProduct, softDeleteProduct } from './products.service';
import { createProductSchema, updateProductSchema } from './products.types';

export async function handleListProducts(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listProducts());
  } catch (err) {
    next(err);
  }
}

export async function handleCreateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    res.status(201).json(await createProduct(parsed.data));
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const product = await updateProduct(req.params.id, parsed.data);
    if (!product) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ok = await softDeleteProduct(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
```

---

## Task 10: Products — Router + Mount + Verify

**Files:**
- Create: `server/src/features/products/products.routes.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create the router**

```typescript
// server/src/features/products/products.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleListProducts,
  handleCreateProduct,
  handleUpdateProduct,
  handleDeleteProduct,
} from './products.controller';

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get('/', authorize('SALES', 'ADMIN'), handleListProducts);
productsRouter.post('/', authorize('ADMIN'), handleCreateProduct);
productsRouter.put('/:id', authorize('ADMIN'), handleUpdateProduct);
productsRouter.delete('/:id', authorize('ADMIN'), handleDeleteProduct);
```

- [ ] **Step 2: Mount in app.ts**

Add this import to `server/src/app.ts`:
```typescript
import { productsRouter } from './features/products/products.routes';
```

Add this route mount after `app.use('/clients', clientsRouter)`:
```typescript
app.use('/products', productsRouter);
```

- [ ] **Step 3: Run products tests — verify they pass**

Run: `cd server && npx jest features/products --no-coverage`
Expected: all tests PASS (unit + integration)

- [ ] **Step 4: Run all tests**

Run: `cd server && npx jest --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/features/products/ server/src/app.ts
git commit -m "feat: add products CRUD API with auto-computed finalPrice"
```

---

## Task 11: Kits — Types

**Files:**
- Create: `server/src/features/kits/kits.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// server/src/features/kits/kits.types.ts
import { z } from 'zod';

export const kitItemInputSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int().min(1, 'quantity must be at least 1'),
});

export const createKitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  items: z.array(kitItemInputSchema).min(1, 'Kit must have at least one item'),
});

export const updateKitSchema = z.object({
  name: z.string().min(1).optional(),
  items: z.array(kitItemInputSchema).min(1).optional(),
});

export type KitItemInput = z.infer<typeof kitItemInputSchema>;
export type CreateKitInput = z.infer<typeof createKitSchema>;
export type UpdateKitInput = z.infer<typeof updateKitSchema>;
```

---

## Task 12: Kits — Service (TDD: Unit Test First)

**Files:**
- Create: `server/src/features/kits/kits.service.test.ts`
- Create: `server/src/features/kits/kits.service.ts`

- [ ] **Step 1: Write the failing unit test**

```typescript
// server/src/features/kits/kits.service.test.ts
import { computeKitTotalPriceFromMap } from './kits.service';

describe('computeKitTotalPriceFromMap', () => {
  it('sums quantity × finalPrice for each item', () => {
    const priceMap = new Map([
      ['prod-1', 10000],
      ['prod-2', 5000],
    ]);
    const items = [
      { productId: 'prod-1', quantity: 2 },
      { productId: 'prod-2', quantity: 3 },
    ];
    // (10000 × 2) + (5000 × 3) = 20000 + 15000 = 35000
    expect(computeKitTotalPriceFromMap(items, priceMap)).toBe(35000);
  });

  it('returns 0 for an empty items array', () => {
    expect(computeKitTotalPriceFromMap([], new Map())).toBe(0);
  });

  it('treats unknown productId as 0 price', () => {
    const priceMap = new Map([['prod-1', 10000]]);
    expect(computeKitTotalPriceFromMap([{ productId: 'unknown', quantity: 5 }], priceMap)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd server && npx jest kits.service.test --no-coverage`
Expected: FAIL — `Cannot find module './kits.service'`

- [ ] **Step 3: Create the service**

```typescript
// server/src/features/kits/kits.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateKitInput, KitItemInput, UpdateKitInput } from './kits.types';

export function computeKitTotalPriceFromMap(
  items: KitItemInput[],
  priceMap: Map<string, number>,
): number {
  return items.reduce((sum, item) => sum + (priceMap.get(item.productId) ?? 0) * item.quantity, 0);
}

// Include shape used by both list and single-kit responses
const kitInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true, finalPrice: true, unit: true } },
    },
  },
} as const;

async function buildPriceMap(productIds: string[]): Promise<Map<string, number>> {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, finalPrice: true },
  });
  return new Map(products.map(p => [p.id, p.finalPrice]));
}

export function listKits() {
  return prisma.kit.findMany({
    where: { isActive: true },
    include: kitInclude,
    orderBy: { name: 'asc' },
  });
}

type CreateKitResult =
  | { kit: Awaited<ReturnType<typeof prisma.kit.create>>; error?: never }
  | { error: 'INVALID_PRODUCT'; ids: string[]; kit?: never };

export async function createKit(data: CreateKitInput): Promise<CreateKitResult> {
  const productIds = data.items.map(i => i.productId);
  const priceMap = await buildPriceMap(productIds);

  const missingIds = productIds.filter(id => !priceMap.has(id));
  if (missingIds.length > 0) return { error: 'INVALID_PRODUCT', ids: missingIds };

  const totalPrice = computeKitTotalPriceFromMap(data.items, priceMap);

  const kit = await prisma.kit.create({
    data: {
      name: data.name,
      totalPrice,
      items: {
        create: data.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      },
    },
    include: kitInclude,
  });

  return { kit };
}

type UpdateKitResult =
  | { kit: Awaited<ReturnType<typeof prisma.kit.findUnique>>; error?: never }
  | { error: 'NOT_FOUND' | 'INVALID_PRODUCT'; ids?: string[]; kit?: never };

export async function updateKit(id: string, data: UpdateKitInput): Promise<UpdateKitResult> {
  const existing = await prisma.kit.findFirst({ where: { id, isActive: true } });
  if (!existing) return { error: 'NOT_FOUND' };

  if (data.items) {
    const productIds = data.items.map(i => i.productId);
    const priceMap = await buildPriceMap(productIds);
    const missingIds = productIds.filter(pid => !priceMap.has(pid));
    if (missingIds.length > 0) return { error: 'INVALID_PRODUCT', ids: missingIds };

    const totalPrice = computeKitTotalPriceFromMap(data.items, priceMap);

    await prisma.$transaction(async tx => {
      await tx.kitItem.deleteMany({ where: { kitId: id } });
      await tx.kit.update({
        where: { id },
        data: {
          name: data.name ?? existing.name,
          totalPrice,
          items: {
            create: data.items!.map(i => ({ productId: i.productId, quantity: i.quantity })),
          },
        },
      });
    });
  } else if (data.name) {
    await prisma.kit.update({ where: { id }, data: { name: data.name } });
  }

  const kit = await prisma.kit.findUnique({ where: { id }, include: kitInclude });
  return { kit };
}
```

- [ ] **Step 4: Run unit tests — verify they pass**

Run: `cd server && npx jest kits.service.test --no-coverage`
Expected: all 3 tests PASS

---

## Task 13: Kits — Write Failing Integration Tests

**Files:**
- Create: `server/src/features/kits/kits.routes.test.ts`

- [ ] **Step 1: Write the integration tests**

```typescript
// server/src/features/kits/kits.routes.test.ts
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
      data: { name: `${UNIQUE} ProductA`, basePrice: 10000, markupPercent: 20, finalPrice: 12000, stockQty: 0 },
    }),
    prisma.product.create({
      data: { name: `${UNIQUE} ProductB`, basePrice: 5000, markupPercent: 0, finalPrice: 5000, stockQty: 0 },
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd server && npx jest features/kits/kits.routes --no-coverage`
Expected: FAIL — all requests return 404 (routes not mounted yet)

---

## Task 14: Kits — Controller

**Files:**
- Create: `server/src/features/kits/kits.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// server/src/features/kits/kits.controller.ts
import { Request, Response, NextFunction } from 'express';
import { listKits, createKit, updateKit } from './kits.service';
import { createKitSchema, updateKitSchema } from './kits.types';

export async function handleListKits(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listKits());
  } catch (err) {
    next(err);
  }
}

export async function handleCreateKit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createKitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = await createKit(parsed.data);
    if (result.error) {
      res.status(400).json({ error: 'One or more products not found or inactive', code: result.error });
      return;
    }
    res.status(201).json(result.kit);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateKit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateKitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = await updateKit(req.params.id, parsed.data);
    if (result.error === 'NOT_FOUND') {
      res.status(404).json({ error: 'Kit not found', code: 'NOT_FOUND' });
      return;
    }
    if (result.error === 'INVALID_PRODUCT') {
      res.status(400).json({ error: 'One or more products not found or inactive', code: 'INVALID_PRODUCT' });
      return;
    }
    res.json(result.kit);
  } catch (err) {
    next(err);
  }
}
```

---

## Task 15: Kits — Router + Mount + Verify

**Files:**
- Create: `server/src/features/kits/kits.routes.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: Create the router**

```typescript
// server/src/features/kits/kits.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { handleListKits, handleCreateKit, handleUpdateKit } from './kits.controller';

export const kitsRouter = Router();

// All kit routes are ADMIN-only
kitsRouter.use(authenticate, authorize('ADMIN'));

kitsRouter.get('/', handleListKits);
kitsRouter.post('/', handleCreateKit);
kitsRouter.put('/:id', handleUpdateKit);
```

- [ ] **Step 2: Mount in app.ts**

Add this import to `server/src/app.ts`:
```typescript
import { kitsRouter } from './features/kits/kits.routes';
```

Add this route mount after `app.use('/products', productsRouter)`:
```typescript
app.use('/kits', kitsRouter);
```

- [ ] **Step 3: Run kits tests — verify they pass**

Run: `cd server && npx jest features/kits --no-coverage`
Expected: all tests PASS (unit + integration)

- [ ] **Step 4: Run all tests**

Run: `cd server && npx jest --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: TypeScript check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add server/src/features/kits/ server/src/app.ts
git commit -m "feat: add kits CRUD API with items management and auto-computed totalPrice"
```

---

## Deliverables Checklist

- [ ] `features/clients/clients.types.ts` — Zod schemas, TypeScript types
- [ ] `features/clients/clients.service.ts` — listClients, getClientById, createClient, updateClient, softDeleteClient
- [ ] `features/clients/clients.controller.ts` — 5 HTTP handlers with Zod validation + error mapping
- [ ] `features/clients/clients.routes.ts` — router (SALES+ADMIN on most, ADMIN-only on DELETE)
- [ ] `features/clients/clients.routes.test.ts` — 14 integration tests covering auth, RBAC, CRUD, error codes
- [ ] `features/products/products.types.ts` — Zod schemas
- [ ] `features/products/products.service.ts` — computeFinalPrice + DB operations
- [ ] `features/products/products.service.test.ts` — 4 unit tests for computeFinalPrice
- [ ] `features/products/products.controller.ts` — 4 HTTP handlers
- [ ] `features/products/products.routes.ts` — router (SALES+ADMIN on GET, ADMIN-only on mutate)
- [ ] `features/products/products.routes.test.ts` — 11 integration tests
- [ ] `features/kits/kits.types.ts` — Zod schemas
- [ ] `features/kits/kits.service.ts` — computeKitTotalPriceFromMap + listKits, createKit, updateKit
- [ ] `features/kits/kits.service.test.ts` — 3 unit tests for computeKitTotalPriceFromMap
- [ ] `features/kits/kits.controller.ts` — 3 HTTP handlers
- [ ] `features/kits/kits.routes.ts` — ADMIN-only router (GET, POST, PUT)
- [ ] `features/kits/kits.routes.test.ts` — 11 integration tests
- [ ] `app.ts` updated — mounts /clients, /products, /kits
- [ ] All existing 34 tests still passing
