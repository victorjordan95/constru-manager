# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the constru-manager monorepo with a working Express server (Helmet, CORS, health endpoint), Zod-validated env config, all 14 Prisma models migrated, and the Vite + React client scaffold with design tokens.

**Architecture:** Monorepo with `client/` (Vite + React 19 + TS strict) and `server/` (Express + Prisma + TS strict). Server validates all env vars at startup via Zod and crashes fast on missing config. Client is pure scaffold — no business logic in Phase 1.

**Tech Stack:** Vite, React 19, TypeScript (strict), TanStack Query v5, TanStack Router, Zustand, Zod, idb-keyval, axios, SASS | Express, Prisma, PostgreSQL, Zod, bcryptjs, jsonwebtoken, Helmet, CORS, dotenv | Jest, ts-jest, supertest

---

## File Map

```
constru-manager/
├── .gitignore
├── client/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── config/
│       │   └── env.ts                       ← VITE_ env vars, typed
│       ├── styles/
│       │   └── tokens.scss                  ← all CSS custom properties
│       └── features/
│           ├── auth/index.ts
│           ├── clients/index.ts
│           ├── products/index.ts
│           ├── kits/index.ts
│           ├── quotes/index.ts
│           ├── approvals/index.ts
│           ├── cash-flow/index.ts
│           ├── fixed-expenses/index.ts
│           ├── inventory/index.ts
│           ├── reports/index.ts
│           └── dashboard/index.ts
└── server/
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── jest.config.ts
    ├── jest.setup.ts                        ← sets env vars for all tests
    └── src/
        ├── server.ts                        ← entry point, starts HTTP server
        ├── app.ts                           ← Express app (importable without listening)
        ├── config/
        │   ├── env.schema.ts                ← Zod schema, no side effects (testable)
        │   └── env.ts                       ← validates process.env, exports env, crashes on failure
        ├── routes/
        │   └── health.ts                    ← GET /health → { status, timestamp }
        ├── middlewares/
        │   └── errorHandler.ts             ← centralized error handler
        └── prisma/
            └── schema.prisma                ← all 14 models + enums
```

---

## Task 1: Initialize Monorepo

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Init git repo**

```bash
cd C:/freela/constru-manager
git init
```

Expected: `Initialized empty Git repository in .../constru-manager/.git/`

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.env
*.env.local
.DS_Store
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: initialize monorepo"
```

---

## Task 2: Scaffold Client

**Files:**
- Create: `client/` (via Vite CLI)
- Modify: `client/tsconfig.json`
- Modify: `client/vite.config.ts`

- [ ] **Step 1: Create Vite app**

```bash
cd C:/freela/constru-manager
npm create vite@latest client -- --template react-ts
```

When prompted, confirm the `client` directory.

- [ ] **Step 2: Install client dependencies**

```bash
cd client
npm install
npm install @tanstack/react-query@5 @tanstack/react-router zustand zod idb-keyval axios
npm install -D sass @types/node
```

- [ ] **Step 3: Replace tsconfig.json with strict config**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 4: Update tsconfig.app.json (created by Vite)**

Open `client/tsconfig.app.json` and ensure it contains:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Replace vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 6: Verify client builds**

```bash
cd C:/freela/constru-manager/client
npm run build
```

Expected: `✓ built in ...ms` with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
cd C:/freela/constru-manager
git add client/
git commit -m "feat(client): scaffold Vite React TS app with strict mode and path aliases"
```

---

## Task 3: Client Structure — Feature Folders and Design Tokens

**Files:**
- Create: `client/src/features/*/index.ts` (11 barrel files)
- Create: `client/src/styles/tokens.scss`
- Create: `client/src/config/env.ts`

- [ ] **Step 1: Create feature barrel files**

Run from `constru-manager/`:

```bash
mkdir -p client/src/features/auth \
         client/src/features/clients \
         client/src/features/products \
         client/src/features/kits \
         client/src/features/quotes \
         client/src/features/approvals \
         client/src/features/cash-flow \
         client/src/features/fixed-expenses \
         client/src/features/inventory \
         client/src/features/reports \
         client/src/features/dashboard \
         client/src/styles \
         client/src/config
```

- [ ] **Step 2: Create barrel index.ts for each feature**

Create `client/src/features/auth/index.ts`:
```typescript
// Auth feature public API — export components, hooks, types here as they are built
```

Repeat the same one-liner comment for each of the 10 remaining features:
- `client/src/features/clients/index.ts`
- `client/src/features/products/index.ts`
- `client/src/features/kits/index.ts`
- `client/src/features/quotes/index.ts`
- `client/src/features/approvals/index.ts`
- `client/src/features/cash-flow/index.ts`
- `client/src/features/fixed-expenses/index.ts`
- `client/src/features/inventory/index.ts`
- `client/src/features/reports/index.ts`
- `client/src/features/dashboard/index.ts`

- [ ] **Step 3: Create client/src/config/env.ts**

```typescript
// All VITE_ prefixed vars are injected at build time by Vite — never use process.env here
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not defined. Add it to your .env file.');
}

export const config = {
  apiBaseUrl: apiBaseUrl as string,
} as const;
```

- [ ] **Step 4: Create client/src/styles/tokens.scss**

```scss
// Design tokens — spec §16.2
// Never hardcode hex values in components. Always reference these variables.

:root {
  // Primary
  --color-primary:       #2C5282;
  --color-primary-light: #4A90D9;
  --color-primary-bg:    #EBF4FF;

  // Status — Success
  --color-success:       #276749;
  --color-success-bg:    #F0FAF4;

  // Status — Warning
  --color-warning:       #B7791F;
  --color-warning-bg:    #FFFBEA;

  // Status — Danger
  --color-danger:        #C53030;
  --color-danger-bg:     #FFF0F0;

  // Neutral
  --color-neutral-900:   #1A202C;
  --color-neutral-600:   #4A5568;
  --color-neutral-300:   #CBD5E0;
  --color-neutral-100:   #F7FAFC;
  --color-surface:       #FFFFFF;

  // Typography
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-base: 16px;

  // Spacing (8px base grid)
  --space-1:  8px;
  --space-2:  16px;
  --space-3:  24px;
  --space-4:  32px;
  --space-5:  40px;
  --space-6:  48px;
  --space-8:  64px;

  // Sidebar
  --sidebar-width: 240px;
}
```

- [ ] **Step 5: Import tokens in main.tsx**

Open `client/src/main.tsx` and add the import at the top:

```typescript
import '@/styles/tokens.scss';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Verify build still passes**

```bash
cd C:/freela/constru-manager/client
npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/
git commit -m "feat(client): add feature scaffolding, design tokens, and env config"
```

---

## Task 4: Scaffold Server

**Files:**
- Create: `server/package.json` (via npm init)
- Create: `server/tsconfig.json`
- Create: `server/.env.example`

- [ ] **Step 1: Initialize server package**

```bash
cd C:/freela/constru-manager
mkdir server && cd server && npm init -y
```

- [ ] **Step 2: Install server dependencies**

```bash
npm install express @prisma/client zod bcryptjs jsonwebtoken helmet cors dotenv
npm install -D typescript @types/express @types/node @types/bcryptjs @types/jsonwebtoken ts-node nodemon jest ts-jest @types/jest supertest @types/supertest
```

- [ ] **Step 3: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Add scripts to server/package.json**

Open `server/package.json` and set the `scripts` field:

```json
{
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

- [ ] **Step 5: Create server/.env.example**

```
# Copy this file to .env and fill in real values
# NEVER commit .env — only .env.example is committed

DATABASE_URL=postgresql://user:password@localhost:5432/constru_manager
JWT_ACCESS_SECRET=replace-with-min-32-char-random-string-here
JWT_REFRESH_SECRET=replace-with-different-min-32-char-random-string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

- [ ] **Step 6: Add .env to root .gitignore**

Open `C:/freela/constru-manager/.gitignore` and ensure it contains:

```
node_modules/
dist/
.env
*.env.local
.DS_Store
server/node_modules/
client/node_modules/
```

- [ ] **Step 7: Commit**

```bash
cd C:/freela/constru-manager
git add server/
git commit -m "feat(server): initialize Express TypeScript server scaffold"
```

---

## Task 5: Server Test Setup

**Files:**
- Create: `server/jest.config.ts`
- Create: `server/jest.setup.ts`

- [ ] **Step 1: Create server/jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['../jest.setup.ts'],
  clearMocks: true,
};

export default config;
```

- [ ] **Step 2: Create server/jest.setup.ts**

This runs before every test file and sets the required env vars so that importing `config/env.ts` does not crash.

```typescript
// Sets all required environment variables before any test imports app modules
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-padding';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-padding';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
```

- [ ] **Step 3: Verify Jest is configured**

```bash
cd C:/freela/constru-manager/server
npx jest --listTests
```

Expected: empty list (no tests yet), no config errors.

- [ ] **Step 4: Commit**

```bash
cd C:/freela/constru-manager
git add server/jest.config.ts server/jest.setup.ts
git commit -m "test(server): configure Jest with ts-jest and env setup"
```

---

## Task 6: Env Validation — TDD

**Files:**
- Create: `server/src/config/env.schema.ts`
- Create: `server/src/config/env.schema.test.ts`
- Create: `server/src/config/env.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/config/env.schema.test.ts`:

```typescript
import { envSchema } from './env.schema';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: 'test' as const,
};

describe('envSchema', () => {
  it('accepts a fully valid env object', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('rejects when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects JWT_ACCESS_SECRET shorter than 32 chars', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_ACCESS_SECRET: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('JWT_ACCESS_SECRET');
    }
  });

  it('rejects JWT_REFRESH_SECRET shorter than 32 chars', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_REFRESH_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid NODE_ENV value', () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid DATABASE_URL format', () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd C:/freela/constru-manager/server
npx jest src/config/env.schema.test.ts
```

Expected: FAIL — `Cannot find module './env.schema'`

- [ ] **Step 3: Create server/src/config/env.schema.ts**

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string(),
  CORS_ORIGIN: z.string().url('CORS_ORIGIN must be a valid URL'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest src/config/env.schema.test.ts
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Create server/src/config/env.ts**

```typescript
import { envSchema } from './env.schema';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Missing or invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
```

- [ ] **Step 6: Commit**

```bash
cd C:/freela/constru-manager
git add server/src/config/
git commit -m "feat(server): add Zod env validation with crash-fast behavior"
```

---

## Task 7: Health Endpoint — TDD

**Files:**
- Create: `server/src/routes/health.ts`
- Create: `server/src/routes/health.test.ts`
- Create: `server/src/app.ts`
- Create: `server/src/middlewares/errorHandler.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/health.test.ts`:

```typescript
import request from 'supertest';
import app from '../app';

describe('GET /health', () => {
  it('returns 200 with status ok and a timestamp', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.timestamp).toBe('string');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd C:/freela/constru-manager/server
npx jest src/routes/health.test.ts
```

Expected: FAIL — `Cannot find module '../app'`

- [ ] **Step 3: Create server/src/middlewares/errorHandler.ts**

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';

  // Never expose stack traces in production
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(statusCode).json({
    error: err.message || 'An unexpected error occurred',
    code,
  });
}
```

- [ ] **Step 4: Create server/src/routes/health.ts**

```typescript
import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});
```

- [ ] **Step 5: Create server/src/app.ts**

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Routes
app.use('/health', healthRouter);

// Centralized error handler — must be last
app.use(errorHandler);

export default app;
```

- [ ] **Step 6: Run test — verify it passes**

```bash
npx jest src/routes/health.test.ts
```

Expected: PASS — 2 tests pass.

- [ ] **Step 7: Run all tests**

```bash
npx jest
```

Expected: PASS — all 8 tests (6 env + 2 health) pass.

- [ ] **Step 8: Commit**

```bash
cd C:/freela/constru-manager
git add server/src/
git commit -m "feat(server): add Express app with Helmet, CORS, and health endpoint"
```

---

## Task 8: Server Entry Point

**Files:**
- Create: `server/src/server.ts`

- [ ] **Step 1: Create server/src/server.ts**

```typescript
import app from './app';
import { env } from './config/env';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${env.NODE_ENV} mode`);
});
```

- [ ] **Step 2: Verify dev server starts**

First create a local `.env` file in `server/` (copy from `.env.example` and fill in your PostgreSQL URL):

```bash
cd C:/freela/constru-manager/server
cp .env.example .env
# Edit .env with real values before running
```

Then:

```bash
npm run dev
```

Expected output: `🚀 Server running on port 3000 in development mode`

If you see `❌ Missing or invalid environment variables`, the `.env` file is missing or incomplete — check each required var.

- [ ] **Step 3: Test health endpoint manually**

```bash
curl http://localhost:3000/health
```

Expected:
```json
{"status":"ok","timestamp":"2026-04-06T...Z"}
```

- [ ] **Step 4: Commit**

```bash
cd C:/freela/constru-manager
git add server/src/server.ts
git commit -m "feat(server): add server entry point"
```

---

## Task 9: Prisma Schema — All 14 Models

**Files:**
- Create: `server/src/prisma/schema.prisma` (via `npx prisma init`, then replace content)

- [ ] **Step 1: Create the prisma directory**

```bash
mkdir -p C:/freela/constru-manager/server/src/prisma
```

The schema file is written manually in Step 2 below — no need to run `prisma init`.

- [ ] **Step 2: Replace schema.prisma with the complete schema**

Write the full contents of `server/src/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────────────────────────

enum Role {
  ADMIN
  SALES
  FINANCE
}

enum QuoteStatus {
  PENDING_REVIEW
  ACCEPTED
  REJECTED
  NO_RESPONSE
}

enum PaymentType {
  LUMP_SUM
  INSTALLMENTS
}

enum InstallmentStatus {
  PENDING
  PAID
  OVERDUE
}

enum TransactionType {
  INCOME
  EXPENSE
}

enum MovementType {
  INFLOW
  OUTFLOW
  ADJUSTMENT
}

enum ExpenseLogStatus {
  PENDING
  PAID
}

// ─── Models ──────────────────────────────────────────────────────────────────

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         Role
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
}

model Client {
  id         String   @id @default(cuid())
  name       String
  taxId      String   @unique
  nationalId String?
  address    String?
  zipCode    String?
  email      String?
  phone      String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  quotes     Quote[]
}

model Product {
  id             String          @id @default(cuid())
  name           String
  basePrice      Int
  markupPercent  Decimal         @db.Decimal(5, 2)
  finalPrice     Int
  unit           String?
  stockQty       Int             @default(0)
  minStock       Int?
  isActive       Boolean         @default(true)
  kitItems       KitItem[]
  quoteItems     QuoteItem[]
  stockMovements StockMovement[]
}

model Kit {
  id         String      @id @default(cuid())
  name       String
  totalPrice Int
  isActive   Boolean     @default(true)
  items      KitItem[]
  quoteItems QuoteItem[]
}

model KitItem {
  id        String  @id @default(cuid())
  kit       Kit     @relation(fields: [kitId], references: [id])
  kitId     String
  product   Product @relation(fields: [productId], references: [id])
  productId String
  quantity  Int
}

model Quote {
  id              String         @id @default(cuid())
  client          Client         @relation(fields: [clientId], references: [id])
  clientId        String
  status          QuoteStatus    @default(PENDING_REVIEW)
  activeVersionId String?        @unique
  activeVersion   QuoteVersion?  @relation("ActiveVersion", fields: [activeVersionId], references: [id])
  versions        QuoteVersion[] @relation("AllVersions")
  sale            Sale?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model QuoteVersion {
  id        String      @id @default(cuid())
  quote     Quote       @relation("AllVersions", fields: [quoteId], references: [id])
  quoteId   String
  activeFor Quote?      @relation("ActiveVersion")
  version   Int
  subtotal  Int
  laborCost Int         @default(0)
  discount  Int         @default(0)
  total     Int
  items     QuoteItem[]
  createdAt DateTime    @default(now())
}

model QuoteItem {
  id             String       @id @default(cuid())
  quoteVersion   QuoteVersion @relation(fields: [quoteVersionId], references: [id])
  quoteVersionId String
  product        Product?     @relation(fields: [productId], references: [id])
  productId      String?
  kit            Kit?         @relation(fields: [kitId], references: [id])
  kitId          String?
  quantity       Int
  unitPrice      Int
  lineTotal      Int
}

model Sale {
  id           String        @id @default(cuid())
  quote        Quote         @relation(fields: [quoteId], references: [id])
  quoteId      String        @unique
  paymentType  PaymentType
  downPayment  Int           @default(0)
  total        Int
  installments Installment[]
  createdAt    DateTime      @default(now())
}

model Installment {
  id          String            @id @default(cuid())
  sale        Sale              @relation(fields: [saleId], references: [id])
  saleId      String
  dueDate     DateTime
  amount      Int
  status      InstallmentStatus @default(PENDING)
  paidAt      DateTime?
  transaction CashTransaction?
}

model CashTransaction {
  id                String           @id @default(cuid())
  type              TransactionType
  amount            Int
  date              DateTime
  origin            String
  description       String?
  installmentId     String?          @unique
  installment       Installment?     @relation(fields: [installmentId], references: [id])
  fixedExpenseLogId String?          @unique
  fixedExpenseLog   FixedExpenseLog? @relation(fields: [fixedExpenseLogId], references: [id])
}

model FixedExpense {
  id       String            @id @default(cuid())
  name     String
  amount   Int
  dueDay   Int
  category String?
  isActive Boolean           @default(true)
  logs     FixedExpenseLog[]
}

model FixedExpenseLog {
  id             String           @id @default(cuid())
  fixedExpense   FixedExpense     @relation(fields: [fixedExpenseId], references: [id])
  fixedExpenseId String
  month          Int
  year           Int
  status         ExpenseLogStatus @default(PENDING)
  paidAt         DateTime?
  transaction    CashTransaction?
}

model StockMovement {
  id        String       @id @default(cuid())
  product   Product      @relation(fields: [productId], references: [id])
  productId String
  type      MovementType
  quantity  Int
  reason    String
  createdAt DateTime     @default(now())
}
```

- [ ] **Step 3: Update package.json prisma config to point to schema location**

Add to `server/package.json`:

```json
{
  "prisma": {
    "schema": "src/prisma/schema.prisma"
  }
}
```

- [ ] **Step 4: Validate schema syntax**

```bash
cd C:/freela/constru-manager/server
npx prisma validate
```

Expected: `The schema at src/prisma/schema.prisma is valid`

- [ ] **Step 5: Commit schema before migrating**

```bash
cd C:/freela/constru-manager
git add server/src/prisma/ server/package.json
git commit -m "feat(server): add complete Prisma schema with all 14 models"
```

---

## Task 10: Run Initial Migration

**Prerequisites:** PostgreSQL running and `DATABASE_URL` set correctly in `server/.env`

- [ ] **Step 1: Generate and apply migration**

```bash
cd C:/freela/constru-manager/server
npx prisma migrate dev --name init
```

Expected output:
```
Applying migration `20260406000000_init`
Your database is now in sync with your schema.
Generated Prisma Client
```

If you see `P1001: Can't reach database server`, verify:
- PostgreSQL is running
- `DATABASE_URL` in `server/.env` is correct (host, port, user, password, database name)
- The database exists: `createdb constru_manager` (or create via psql)

- [ ] **Step 2: Verify Prisma Client was generated**

```bash
ls node_modules/@prisma/client
```

Expected: directory exists with generated types.

- [ ] **Step 3: Verify all tables exist**

```bash
npx prisma studio
```

Expected: Prisma Studio opens at `http://localhost:5555` showing all 14 models in the left panel:
User, Client, Product, Kit, KitItem, Quote, QuoteVersion, QuoteItem, Sale, Installment, CashTransaction, FixedExpense, FixedExpenseLog, StockMovement.

Close Prisma Studio with `Ctrl+C` when done.

- [ ] **Step 4: Commit migration files**

```bash
cd C:/freela/constru-manager
git add server/src/prisma/migrations/
git commit -m "feat(server): apply initial database migration"
```

---

## Task 11: Final Phase 1 Verification

- [ ] **Step 1: Run all server tests**

```bash
cd C:/freela/constru-manager/server
npx jest
```

Expected: all 8 tests pass, 0 failures.

- [ ] **Step 2: Start server and hit health endpoint**

```bash
npm run dev
```

In a second terminal:

```bash
curl -s http://localhost:3000/health | python -m json.tool
```

Expected:
```json
{
  "status": "ok",
  "timestamp": "2026-04-06T..."
}
```

- [ ] **Step 3: Build client**

```bash
cd C:/freela/constru-manager/client
npm run build
```

Expected: `✓ built in ...ms` with no TypeScript errors.

- [ ] **Step 4: Final commit**

```bash
cd C:/freela/constru-manager
git add .
git commit -m "chore: Phase 1 complete — monorepo scaffold, env validation, Prisma schema, Express skeleton"
```

---

## Phase 1 Deliverables

- [x] Monorepo: `client/` + `server/` under `constru-manager/`
- [x] Client: Vite + React 19 + TS strict, `@/` path alias, all feature folders, `tokens.scss`
- [x] Server: Express + TS strict, Helmet, CORS
- [x] `server/src/config/env.ts`: Zod validation, process.exit on invalid env
- [x] `server/.env.example`: all 7 required vars documented
- [x] `GET /health`: returns `{ status: "ok", timestamp }` — 2 passing tests
- [x] `server/src/prisma/schema.prisma`: 14 models, 7 enums, correct relations
- [x] Initial migration applied to PostgreSQL
- [x] All 8 unit tests passing
