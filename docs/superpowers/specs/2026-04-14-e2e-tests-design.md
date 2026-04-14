# E2E Tests Implementation Design

## Goal

Add end-to-end tests with Playwright covering all application flows: clients, products, kits, quotes (full chain), fixed expenses, and finance dashboard. Tests are self-contained — they spin up a dedicated Postgres container and Express server automatically.

## Architecture

**Playwright** with the fixture system for composable context. Tests run serially against a dedicated Postgres container (Docker) and an Express server on port 3001. Auth sessions are saved once per role via `storageState` and reused across specs.

**Tech Stack:** Playwright, Docker Compose, TypeScript, axios (for fixture API calls)

---

## Infrastructure

### Docker Compose

`e2e/docker-compose.test.yml` — Postgres on port 5433 (avoids conflict with dev db on 5432):

```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: constru_manager_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
```

`tmpfs` keeps the data in memory — container destruction wipes it clean.

### Environment

`e2e/.env.test`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/constru_manager_test
PORT=3001
JWT_SECRET=e2e-test-secret
JWT_REFRESH_SECRET=e2e-test-refresh-secret
NODE_ENV=test
```

### Global Setup (`e2e/global-setup.ts`)

1. `docker compose -f e2e/docker-compose.test.yml up -d` — start Postgres
2. Wait for Postgres to be ready (retry loop on TCP connect)
3. `prisma migrate deploy` with `DATABASE_URL` pointing to test db
4. Seed the three test users (ADMIN, SALES, FINANCE) via Prisma client
5. Start Express server as a child process on port 3001, wait for it to respond

### Global Teardown (`e2e/global-teardown.ts`)

1. Kill the Express server process
2. `docker compose -f e2e/docker-compose.test.yml down`

---

## File Structure

```
e2e/
  playwright.config.ts          — baseURL :5173 (Vite preview), projects, globalSetup/Teardown
  docker-compose.test.yml       — Postgres test container
  global-setup.ts               — docker + migrate + seed + server
  global-teardown.ts            — server kill + docker down
  auth.setup.ts                 — login 3 roles, save storageState
  .env.test                     — env vars for test server (gitignored)
  .auth/                        — storageState files (gitignored)
    admin.json
    sales.json
    finance.json
  fixtures/
    index.ts                    — all fixtures exported from one file
  specs/
    clients.spec.ts
    products.spec.ts
    kits.spec.ts
    quotes.spec.ts
    fixed-expenses.spec.ts
    finance.spec.ts
```

---

## Playwright Config (`e2e/playwright.config.ts`)

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,        // serial — shared DB
  workers: 1,
  retries: 0,
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'e2e',
      testMatch: /specs\/.+\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: 'e2e/.auth/admin.json',  // default; overridden per spec
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:5173',
    cwd: '../client',
    reuseExistingServer: false,
  },
})
```

---

## Auth Setup (`e2e/auth.setup.ts`)

Logs in once as each role via the login UI and saves the browser storage state. Runs before all specs.

```ts
import { test as setup, expect } from '@playwright/test'

const USERS = [
  { email: 'admin@constru.dev',      password: 'admin123',   file: 'e2e/.auth/admin.json'   },
  { email: 'vendas@constru.dev',     password: 'sales123',   file: 'e2e/.auth/sales.json'   },
  { email: 'financeiro@constru.dev', password: 'finance123', file: 'e2e/.auth/finance.json' },
]

for (const user of USERS) {
  setup(`login as ${user.email}`, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Senha').fill(user.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL('/')
    await page.context().storageState({ path: user.file })
  })
}
```

---

## Fixtures (`e2e/fixtures/index.ts`)

Two categories:

**Session fixtures** — return an authenticated `Page`:
- `adminPage` — page with ADMIN storageState
- `salesPage` — page with SALES storageState
- `financePage` — page with FINANCE storageState

**Entity fixtures** — create data via direct API calls (axios to `http://localhost:3001`) using an admin token. Return only the ids/fields needed by specs. Cleaned up automatically in fixture teardown.

```ts
import { test as base, expect } from '@playwright/test'
import axios from 'axios'

// API client pointing at test server
const api = axios.create({ baseURL: 'http://localhost:3001' })

// Login once to get token for API fixtures
async function getAdminToken() { ... }

export const test = base.extend<{
  adminPage: Page
  salesPage: Page
  financePage: Page
  createdClient: { id: string; name: string }
  createdProduct: { id: string; name: string; finalPrice: number }
  createdKit: { id: string; name: string }
  acceptedQuote: { saleId: string; installmentId: string }
  createdExpense: { id: string; name: string }
}>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },
  salesPage: async ({ browser }, use) => { /* same with sales.json */ },
  financePage: async ({ browser }, use) => { /* same with finance.json */ },

  createdClient: async ({}, use) => {
    const token = await getAdminToken()
    const { data } = await api.post('/clients', { name: 'E2E Cliente', taxId: `E2E${Date.now()}` }, { headers: { Authorization: `Bearer ${token}` } })
    await use({ id: data.id, name: data.name })
    // no explicit teardown — test DB is wiped between runs
  },

  createdProduct: async ({}, use) => {
    const token = await getAdminToken()
    const { data } = await api.post('/products', { name: 'E2E Produto', basePrice: 10000, markupPercent: 20, finalPrice: 12000, stockQty: 5 }, { headers: { Authorization: `Bearer ${token}` } })
    await use({ id: data.id, name: data.name, finalPrice: data.finalPrice })
  },

  createdKit: async ({}, use) => {
    const token = await getAdminToken()
    // creates its own product internally
    const prod = await api.post('/products', { name: 'E2E Kit Prod', basePrice: 5000, markupPercent: 10, finalPrice: 5500, stockQty: 10 }, { headers: { Authorization: `Bearer ${token}` } })
    const { data } = await api.post('/kits', { name: 'E2E Kit', items: [{ productId: prod.data.id, quantity: 2 }] }, { headers: { Authorization: `Bearer ${token}` } })
    await use({ id: data.id, name: data.name })
  },

  acceptedQuote: async ({}, use) => {
    const token = await getAdminToken()
    // create client, product, quote, version, accept with 1 installment
    // returns { saleId, installmentId }
    // full implementation in plan
    await use({ saleId, installmentId })
  },

  createdExpense: async ({}, use) => {
    const token = await getAdminToken()
    const { data } = await api.post('/fixed-expenses', { name: 'E2E Conta Luz', amount: 15000, dueDay: 10 }, { headers: { Authorization: `Bearer ${token}` } })
    await use({ id: data.id, name: data.name })
  },
})

export { expect }
```

---

## Spec Files

### `clients.spec.ts`

Uses `adminPage`. Tests:
1. **Criar** — navega a `/clients/new`, preenche nome + CPF/CNPJ, submete, verifica item na lista
2. **Editar** — clica em Editar no cliente criado, altera nome, salva, verifica novo nome na lista
3. **Desativar** — clica em Desativar, confirma modal, verifica que cliente some da lista

### `products.spec.ts`

Uses `adminPage`. Tests:
1. **Criar** — `/products/new`, preenche nome + preço base + markup, verifica preço final calculado, submete
2. **Editar** — altera preço base, verifica que preço final recalcula, salva
3. **Desativar** — desativa, verifica remoção da lista

### `kits.spec.ts`

Uses `adminPage` + `createdProduct`. Tests:
1. **Criar** — `/kits/new`, preenche nome, adiciona `createdProduct` como item, verifica preço total, submete
2. **Editar** — altera nome do kit, salva, verifica na lista

### `quotes.spec.ts`

Uses `salesPage` + `createdClient` + `createdProduct`. Tests:
1. **Criar orçamento** — `/quotes/new`, seleciona `createdClient`, adiciona `createdProduct`, verifica total
2. **Adicionar revisão** — na página de detalhe, clica em "Nova revisão", adiciona item com desconto, verifica novo total
3. **Aceitar com parcelas** — clica Aceitar, escolhe INSTALLMENTS, define 2 parcelas, confirma, verifica status ACCEPTED e parcelas criadas

### `fixed-expenses.spec.ts`

Uses `financePage`. Tests:
1. **Criar** — `/fixed-expenses/new`, preenche nome + valor + dia, submete, verifica na lista
2. **Editar** — altera valor, salva, verifica novo valor na lista
3. **Desativar** — confirma, verifica remoção da lista

### `finance.spec.ts`

Uses `financePage` + `acceptedQuote` + `createdExpense`. Tests:
1. **Definir saldo inicial** — clica "Editar saldo inicial", informa R$ 1.000,00, salva, verifica saldo exibido
2. **Dashboard mensal** — verifica que parcela de `acceptedQuote` aparece na tabela do mês corrente
3. **Marcar parcela como paga** — clica "Marcar como pago" na parcela, verifica status PAGO e saldo atualizado
4. **Marcar despesa fixa como paga** — navega ao mês da despesa, clica "Marcar como pago", verifica status PAGO

---

## Access Control

| Spec | Role | Acesso esperado |
|------|------|-----------------|
| clients | ADMIN | ✓ |
| products | ADMIN | ✓ |
| kits | ADMIN | ✓ |
| quotes | SALES | ✓ |
| fixed-expenses | FINANCE | ✓ |
| finance | FINANCE | ✓ |

---

## Scripts

```json
// package.json (raiz)
"e2e": "playwright test --config e2e/playwright.config.ts",
"e2e:ui": "playwright test --config e2e/playwright.config.ts --ui"
```

`npm run e2e` — roda tudo headless
`npm run e2e:ui` — abre o Playwright UI para debug

---

## .gitignore additions

```
e2e/.auth/
e2e/.env.test
```
