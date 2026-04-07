# Phase 1 — Foundation Design

**Date:** 2026-04-06  
**Project:** constru-manager (SSD v1.5)  
**Scope:** Monorepo scaffold, env validation, Prisma schema + migration, Express skeleton

---

## Context

Full system spec is defined in `specs/SSD_v1.5_Final.pdf/.docx`. Implementation follows the 11-phase order from Section 17.5. This document covers Phase 1 only.

Approach: monorepo with `client/` (Vite + React + TS) and `server/` (Express + Prisma + TS) at the root.

---

## 1. Monorepo Structure

```
constru-manager/
├── specs/
├── docs/
├── client/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json          # strict mode, path aliases
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── config/env.ts       # VITE_ vars via import.meta.env
│       ├── features/
│       │   ├── auth/
│       │   ├── clients/
│       │   ├── products/
│       │   ├── kits/
│       │   ├── quotes/
│       │   ├── approvals/
│       │   ├── cash-flow/
│       │   ├── fixed-expenses/
│       │   ├── inventory/
│       │   ├── reports/
│       │   └── dashboard/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       ├── providers/
│       ├── stores/
│       ├── utils/
│       ├── styles/
│       │   └── tokens.scss     # all CSS custom properties from spec §16.2
│       └── main.tsx
└── server/
    ├── package.json
    ├── tsconfig.json           # strict mode
    ├── .env.example
    └── src/
        ├── config/
        │   └── env.ts          # Zod env validation — crash on startup if missing
        ├── controllers/
        ├── services/
        ├── repositories/
        ├── middlewares/
        │   └── errorHandler.ts
        ├── routes/
        │   └── health.ts
        ├── utils/
        └── prisma/
            └── schema.prisma   # all 13 models
```

---

## 2. Client Scaffold

- **Init:** `npm create vite@latest client -- --template react-ts`
- **Dependencies:** `@tanstack/react-query`, `@tanstack/react-router`, `zustand`, `zod`, `idb-keyval`, `axios`
- **Dev deps:** `sass`, `@types/node`
- **tsconfig:** `strict: true`, path alias `@/*` → `src/*`
- **vite.config.ts:** resolve alias `@` → `src/`
- **styles/tokens.scss:** all CSS custom properties from spec §16.2 (colors, nothing else in Phase 1)
- **config/env.ts:** exports `VITE_API_BASE_URL` from `import.meta.env` with type safety
- All feature folders created as empty directories with placeholder `index.ts` barrel files

---

## 3. Server Scaffold

- **Init:** `npm init -y` inside `server/`, install all deps from spec §17.1
- **tsconfig:** `strict: true`, `moduleResolution: node`, `outDir: dist`
- **config/env.ts:** Zod schema validates all 7 required env vars at startup — process exits if any are missing
- **Required env vars:**
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET` (min 32 chars)
  - `JWT_REFRESH_SECRET` (min 32 chars)
  - `JWT_ACCESS_EXPIRES_IN`
  - `JWT_REFRESH_EXPIRES_IN`
  - `CORS_ORIGIN`
  - `NODE_ENV`
- **.env.example:** placeholder values for all vars — this is the only env file committed
- **Express app:** Helmet, CORS (only `CORS_ORIGIN`, no wildcard), JSON body parser, health route, centralized error handler
- **Health endpoint:** `GET /health` → `{ status: "ok", timestamp: ISO string }` — public, no auth

---

## 4. Prisma Schema — All 14 Models

Models per spec §17.6:

| Model | Key fields |
|---|---|
| User | id, email, passwordHash, role (ADMIN/SALES/FINANCE), isActive, createdAt |
| Client | id, name, taxId (unique), nationalId?, address?, zipCode?, email?, phone?, isActive, createdAt |
| Product | id, name, basePrice (Int cents), markupPercent, finalPrice (Int cents), unit?, stockQty, minStock?, isActive |
| Kit | id, name, totalPrice (Int cents), items: KitItem[] |
| KitItem | id, kitId, productId, quantity |
| Quote | id, clientId, status (PENDING_REVIEW/ACCEPTED/REJECTED/NO_RESPONSE), activeVersionId?, createdAt, updatedAt |
| QuoteVersion | id, quoteId, version, subtotal, laborCost, discount, total, createdAt |
| QuoteItem | id, quoteVersionId, productId?, kitId?, quantity, unitPrice, lineTotal |
| Sale | id, quoteId, paymentType (LUMP_SUM/INSTALLMENTS), downPayment, total, createdAt |
| Installment | id, saleId, dueDate, amount, status (PENDING/PAID/OVERDUE), paidAt? |
| CashTransaction | id, type (INCOME/EXPENSE), amount (Int cents), date, origin, description?, referenceId? |
| FixedExpense | id, name, amount (Int cents), dueDay, category?, isActive |
| FixedExpenseLog | id, fixedExpenseId, month, year, status (PENDING/PAID), paidAt? |
| StockMovement | id, productId, type (INFLOW/OUTFLOW/ADJUSTMENT), quantity, reason, createdAt |

**Key decisions:**
- All monetary values stored as integers (cents) per spec §17.9
- Soft deletes via `isActive` on Client, Product, Kit — no hard deletes
- Quote has self-referential `activeVersionId` pointing to the latest QuoteVersion

---

## 5. Migration

- `npx prisma migrate dev --name init` — generates and applies the initial migration
- Migration file committed to `server/src/prisma/migrations/`
- Prisma Client generated automatically

---

## 6. Error Handling Convention

Centralized middleware catches all errors and returns:
```json
{ "error": "Human readable message", "code": "ERROR_CODE" }
```
Stack traces never exposed in production (`NODE_ENV === 'production'`).

---

## 7. What Phase 1 Does NOT Include

- Authentication (Phase 2)
- Any business logic routes (Phase 3+)
- Frontend UI components or pages (Phase 8 — design system)
- PDF generation, offline features, etc.

---

## Deliverables Checklist

- [ ] `client/` scaffold with strict TS, aliases, all feature folders, tokens.scss
- [ ] `server/` scaffold with strict TS, Helmet, CORS, health endpoint
- [ ] `server/src/config/env.ts` — Zod env validation, crash on missing vars
- [ ] `server/.env.example` — all required vars with placeholder values
- [ ] `server/src/prisma/schema.prisma` — all 14 models, correct relations
- [ ] Initial Prisma migration applied and committed
- [ ] `GET /health` returns 200 with `{ status: "ok" }`
