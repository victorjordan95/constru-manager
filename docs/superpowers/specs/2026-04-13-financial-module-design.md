# Financial Module Implementation Design

## Goal

Add a financial module to Constru Manager with: cash balance (manual opening balance + auto-calculated from transactions), a monthly dashboard (incoming/outgoing/net profit), installment payment tracking, fixed expense management, and monthly fixed-expense payment tracking.

## Architecture

Two new server feature modules (`finance`, `fixed-expenses`) plus two new frontend pages (`/finance`, `/fixed-expenses`). One new Prisma model (`FinanceSettings`) for the opening balance. All financial routes restricted to `ADMIN` and `FINANCE` roles.

**Tech Stack:** Express + Prisma (server), React 19 + TanStack Query v5 + TanStack Router v1 (client), TypeScript throughout, Zod for validation.

---

## Schema Changes

Add one new model to `server/src/prisma/schema.prisma`:

```prisma
model FinanceSettings {
  id             String @id @default("singleton")
  openingBalance Int    @default(0)
}
```

A single row with fixed id `"singleton"`. Always upserted — never inserted twice.

**Cash balance formula:**
```
balance = openingBalance
        + Σ CashTransaction WHERE type = INCOME
        - Σ CashTransaction WHERE type = EXPENSE
```

**Transactions are created automatically when:**
- An `Installment` is marked as paid → `CashTransaction { type: INCOME, origin: 'INSTALLMENT', amount, date: now, description: client name }`
- A `FixedExpenseLog` is marked as paid → `CashTransaction { type: EXPENSE, origin: 'FIXED_EXPENSE', amount, date: now, description: expense name }`

---

## Server API

### Feature: `finance`

All routes under `/finance`, restricted to `ADMIN` and `FINANCE`.

#### `GET /finance/summary?month=<1-12>&year=<YYYY>`

Auto-creates missing `FixedExpenseLog` rows for the requested month (for all active `FixedExpense` records). Returns:

```ts
{
  balance: number               // openingBalance + all INCOME - all EXPENSE
  openingBalance: number
  month: number
  year: number
  projected: {
    incoming: number            // sum of PENDING installments due this month
    outgoing: number            // sum of PENDING fixed expense logs this month
    netProfit: number           // paid INCOME this month - paid EXPENSE this month
  }
  installments: Array<{
    id: string
    dueDate: string             // ISO date
    amount: number
    status: 'PENDING' | 'PAID' | 'OVERDUE'
    clientName: string
    quoteId: string
  }>
  expenseLogs: Array<{
    id: string
    fixedExpenseName: string
    category: string | null
    dueDay: number
    amount: number
    status: 'PENDING' | 'PAID'
  }>
}
```

#### `GET /finance/balance`

Returns `{ openingBalance: number }`.

#### `PUT /finance/balance`

Body: `{ openingBalance: number }` (integer, min 0).
Upserts `FinanceSettings`. Returns `{ openingBalance: number }`.

#### `PATCH /finance/installments/:id/pay`

- Finds `Installment` by id. Returns 404 if not found.
- Returns 400 if already PAID.
- In a transaction: sets `status = PAID`, `paidAt = now()`, creates `CashTransaction { type: INCOME, amount, date: now, origin: 'INSTALLMENT', description: client name, installmentId }`.
- Returns updated installment.

#### `PATCH /finance/expense-logs/:id/pay`

- Finds `FixedExpenseLog` by id. Returns 404 if not found.
- Returns 400 if already PAID.
- In a transaction: sets `status = PAID`, `paidAt = now()`, creates `CashTransaction { type: EXPENSE, amount: fixedExpense.amount, date: now, origin: 'FIXED_EXPENSE', description: expense name, fixedExpenseLogId }`.
- Returns updated log.

---

### Feature: `fixed-expenses`

All routes under `/fixed-expenses`, restricted to `ADMIN` and `FINANCE`.

#### `GET /fixed-expenses`

Returns all active fixed expenses ordered by `name asc`.

```ts
Array<{
  id: string
  name: string
  amount: number
  dueDay: number        // 1–28
  category: string | null
  isActive: boolean
}>
```

#### `POST /fixed-expenses`

Body: `{ name: string, amount: number (int, min 1), dueDay: number (int, 1–28), category?: string }`.
Returns 201 + created record.

#### `PUT /fixed-expenses/:id`

Body: same fields as POST, all optional.
Returns 404 if not found or inactive. Returns updated record.

#### `DELETE /fixed-expenses/:id`

Soft-delete: sets `isActive = false`. Returns 204. Returns 404 if not found.

---

## Frontend

### New pages

#### `/finance` — FinanceDashboardPage

- **Month selector:** `< Abril 2026 >` buttons. State: `{ month, year }` defaulting to current month/year.
- **Saldo em Caixa card:** Shows calculated balance. Edit button opens an inline input to update `openingBalance` (PUT `/finance/balance`).
- **Three summary cards:**
  - Previsto Entrar — `projected.incoming` (sum of PENDING installments this month)
  - Previsto Sair — `projected.outgoing` (sum of PENDING expense logs this month)
  - Lucro Líquido — `projected.netProfit` (paid income − paid expense this month)
- **Installments table:** columns: Cliente, Vencimento, Valor, Status badge, Action. "Marcar como pago" button when `status === 'PENDING'`. Clicking calls `PATCH /finance/installments/:id/pay` then refetches summary.
- **Fixed expense logs table:** columns: Despesa, Categoria, Dia, Valor, Status badge, Action. "Marcar como pago" when `status === 'PENDING'`. Calls `PATCH /finance/expense-logs/:id/pay` then refetches.

#### `/fixed-expenses` — FixedExpensesListPage

- Table: Nome, Valor, Categoria, Dia Vencimento, actions (Editar / Desativar).
- "Nova Despesa" button → `/fixed-expenses/new`.
- Edit → `/fixed-expenses/:id/edit`.

#### `/fixed-expenses/new` and `/fixed-expenses/:id/edit` — FixedExpenseFormPage

- Fields: Nome (text, required), Valor (int, centavos), Dia de Vencimento (number 1–28), Categoria (text, optional).
- On submit: POST (new) or PUT (edit). Redirects to `/fixed-expenses` on success.

---

### Hooks (`client/src/features/finance/hooks.ts`)

```ts
useFinanceSummary(month: number, year: number)   // GET /finance/summary
useUpdateOpeningBalance()                         // PUT /finance/balance
usePayInstallment()                               // PATCH /finance/installments/:id/pay
usePayExpenseLog()                                // PATCH /finance/expense-logs/:id/pay
```

### Hooks (`client/src/features/fixed-expenses/hooks.ts`)

```ts
useFixedExpenses()            // GET /fixed-expenses
useFixedExpense(id)           // GET /fixed-expenses/:id
useCreateFixedExpense()       // POST /fixed-expenses
useUpdateFixedExpense()       // PUT /fixed-expenses/:id
useDeleteFixedExpense()       // DELETE /fixed-expenses/:id
```

---

### Sidebar navigation

Add to `AppLayout.tsx` for roles `ADMIN` and `FINANCE`:

```
Financeiro     → /finance
Despesas Fixas → /fixed-expenses
```

---

## Access Control

| Role    | /finance | /fixed-expenses |
|---------|----------|-----------------|
| ADMIN   | ✅        | ✅               |
| FINANCE | ✅        | ✅               |
| SALES   | ❌        | ❌               |

---

## Data flow: marking an installment as paid

1. User clicks "Marcar como pago" on an installment row in `/finance`.
2. Frontend calls `PATCH /finance/installments/:id/pay`.
3. Server runs in a Prisma transaction:
   - Updates `Installment.status = PAID`, `paidAt = now`.
   - Creates `CashTransaction { type: INCOME, amount, installmentId, origin: 'INSTALLMENT', date: now }`.
4. Returns updated installment.
5. Frontend invalidates `['finance', 'summary']` query — dashboard recalculates.

## Data flow: marking a fixed expense log as paid

1. User clicks "Marcar como pago" on an expense log row.
2. Frontend calls `PATCH /finance/expense-logs/:id/pay`.
3. Server runs in a Prisma transaction:
   - Updates `FixedExpenseLog.status = PAID`, `paidAt = now`.
   - Creates `CashTransaction { type: EXPENSE, amount: fixedExpense.amount, fixedExpenseLogId, origin: 'FIXED_EXPENSE', date: now }`.
4. Returns updated log.
5. Frontend invalidates `['finance', 'summary']`.

## Data flow: auto-creating FixedExpenseLogs

On `GET /finance/summary?month=M&year=Y`, the service:
1. Fetches all active `FixedExpense` records.
2. For each, does `upsert` on `FixedExpenseLog { fixedExpenseId, month: M, year: Y }` — creates if missing, skips if exists.
3. Returns the full summary including these logs.

This is idempotent — safe to call multiple times for the same month.
