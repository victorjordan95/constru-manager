# Multi-Tenancy Design — Constru Manager

**Date:** 2026-04-22  
**Status:** Approved  
**Approach:** Row-level multi-tenancy via `Organization` model

---

## 1. Context

The system currently operates as a single-tenant application — all ADMINs, SALES, and FINANCE users share the same pool of data (clients, products, quotes, etc.). The goal is to make each ADMIN operate in a fully isolated workspace (organization), with no data leakage between organizations.

---

## 2. Roles

| Role | Description |
|---|---|
| `SUPER_ADMIN` | System owner. Creates organizations and their first ADMIN. No `organizationId`. Cannot access business routes. |
| `ADMIN` | Organization owner. Full access to their org's data. Creates SALES and FINANCE users within their org. |
| `SALES` | Belongs to one org. Access to clients, products, kits, quotes. |
| `FINANCE` | Belongs to one org. Access to finance, DRE, fixed expenses. |

---

## 3. Data Model

### New model: `Organization`

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  users         User[]
  clients       Client[]
  products      Product[]
  kits          Kit[]
  quotes        Quote[]
  fixedExpenses FixedExpense[]
  financeSettings FinanceSettings?
}
```

### Enum change

```prisma
enum Role {
  SUPER_ADMIN   // new
  ADMIN
  SALES
  FINANCE
}
```

### Models receiving `organizationId`

| Model | Change |
|---|---|
| `User` | `+ organizationId String?` (nullable — SUPER_ADMIN has no org) |
| `Client` | `+ organizationId String` · `taxId @unique` → `@@unique([taxId, organizationId])` |
| `Product` | `+ organizationId String` |
| `Kit` | `+ organizationId String` |
| `Quote` | `+ organizationId String` |
| `FixedExpense` | `+ organizationId String` |
| `FinanceSettings` | `+ organizationId String @unique` · removes `@id @default("singleton")` pattern |

### Models NOT receiving `organizationId`

`Sale`, `Installment`, `QuoteVersion`, `QuoteItem`, `KitItem`, `FixedExpenseLog`, `StockMovement`, `CashTransaction` — isolation reaches these via join with their parent.

---

## 4. Auth Flow

### JWT payload

```ts
interface JwtPayload {
  userId: string
  role: Role
  organizationId: string | null  // null for SUPER_ADMIN
}
```

### Login change

After credential validation, the server fetches `user.organizationId` and signs it into both access and refresh tokens.

### `authenticate` middleware

Decodes `organizationId` from token and attaches to `req.user`. No behavior change — just carries the extra field.

### `authorize` middleware

New guard: routes tagged as `BUSINESS` reject requests from `SUPER_ADMIN` (`organizationId === null`). Existing role checks remain unchanged.

---

## 5. New API Routes (SUPER_ADMIN only)

```
GET    /organizations                  — list all orgs
POST   /organizations                  — create org { name }
PATCH  /organizations/:id              — update org (name, isActive)
POST   /organizations/:orgId/admin     — create first ADMIN for an org { email, password }
```

All routes protected by `authorize(['SUPER_ADMIN'])`.

---

## 6. Service Layer

### Universal pattern

Every business service function receives `organizationId` as a required parameter injected by the controller from `req.user`:

```ts
// Before
export function listProducts() {
  return prisma.product.findMany({ where: { isActive: true } })
}

// After
export function listProducts(organizationId: string) {
  return prisma.product.findMany({ where: { isActive: true, organizationId } })
}
```

This applies uniformly to all CRUD operations in all 7 feature services.

### `users.controller` — creating SALES/FINANCE

When an ADMIN creates a new user, `organizationId` is taken from `req.user.organizationId` — not from the request body. The new user inherits the ADMIN's org automatically.

### `FinanceSettings` — upsert pattern change

```ts
// Before: singleton by fixed id
prisma.financeSettings.upsert({ where: { id: 'singleton' }, ... })

// After: singleton per org
prisma.financeSettings.upsert({ where: { organizationId }, ... })
```

### Files changed in server

| File | Change |
|---|---|
| `schema.prisma` | + `Organization`, + `organizationId` on 7 models, + `SUPER_ADMIN` role |
| `auth.types.ts` | `organizationId` in `JwtPayload` |
| `auth.service.ts` | include `organizationId` in token signing |
| `auth.controller.ts` | fetch `organizationId` from user record on login |
| `authenticate.ts` | decode and forward `organizationId` |
| `authorize.ts` | block `SUPER_ADMIN` from business routes |
| `clients.service.ts` + `controller.ts` | + `organizationId` param |
| `products.service.ts` + `controller.ts` | + `organizationId` param |
| `kits.service.ts` + `controller.ts` | + `organizationId` param |
| `quotes.service.ts` + `controller.ts` | + `organizationId` param |
| `fixed-expenses.service.ts` + `controller.ts` | + `organizationId` param |
| `finance.service.ts` + `controller.ts` | + `organizationId` param |
| `users.controller.ts` | inherit `organizationId` from `req.user` |
| `*.routes.test.ts` (7 files) | add `organizationId` to all fixtures |
| `organizations.routes.ts` + `controller.ts` + `service.ts` | new feature (SUPER_ADMIN) |
| `seed.ts` | create 1 org + 1 SUPER_ADMIN + 1 ADMIN + demo data linked to org |

**Server total: ~26 files changed, 3 new files.**

**Frontend files changed:**

| File | Change |
|---|---|
| `client/src/lib/jwt.ts` | `AuthUser` + `organizationId: string \| null` |
| `client/src/stores/authStore.ts` | persist `organizationId` |
| `client/src/layouts/AppLayout.tsx` | show "Organizações" only for `SUPER_ADMIN`; hide business links |
| `client/src/router/index.tsx` | new `/organizations` route, restricted to `SUPER_ADMIN` |
| `client/src/features/organizations/` | new screen: list + create org + create ADMIN modals |

**Frontend total: 4 files changed, 1 new feature directory.**

---

## 7. Frontend

### Auth

`AuthUser` in `jwt.ts` gains `organizationId: string | null`. Transparent to all business UI.

### Navigation

`AppLayout` conditionally shows:
- `SUPER_ADMIN`: only "Organizações" link
- All other roles: existing links (unchanged)

### New screen: Organizações (SUPER_ADMIN only)

- List of organizations (name, status, creation date)
- "Nova Organização" button → modal with `name` field
- "Criar Admin" button per org → modal with `email` + `password`

### Business screens

No changes. Isolation is invisible to end users.

---

## 8. Migration Strategy

Single Prisma migration with the following steps (in order):

1. Create `Organization` table
2. Insert default org: `{ id: 'default-org', name: 'Organização Demo' }`
3. Add nullable `organizationId` column to all affected tables
4. Backfill: `UPDATE <table> SET organization_id = 'default-org'`
5. Set `organizationId` to `NOT NULL` on all tables
6. Drop `taxId @unique`, add `@@unique([taxId, organizationId])`
7. Migrate `FinanceSettings`: add `organizationId`, update singleton row, add `@unique`

All existing data is preserved under the default org.

---

## 9. Complexity Assessment

| Dimension | Rating |
|---|---|
| Effort | **High** — ~30 files, 1 migration with backfill, 4 new files |
| Risk | **Medium** — wide but mechanical change; same pattern repeated across all services |
| Reversibility | Low once deployed with real data |
| Estimated dev time | 2–3 focused days |

The work is high in volume but low in novelty: the same `organizationId` filter is applied consistently across all services. No new complex business logic is introduced.
