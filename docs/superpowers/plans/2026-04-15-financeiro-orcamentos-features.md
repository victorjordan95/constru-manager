# Financeiro + Orçamentos — Novas Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar fluxo de caixa visual, seção de inadimplência, PDF de orçamento e duplicação de orçamento.

**Architecture:** 3 novos endpoints no backend (cashflow, overdue, duplicate-quote) + 4 novos componentes/features no frontend. Sem migração de banco — tudo usa tabelas existentes.

**Tech Stack:** Express + Prisma (backend), React + TanStack Query + recharts + @react-pdf/renderer (frontend)

---

## File Map

### Backend — criar/modificar
| Arquivo | Mudança |
|---------|---------|
| `server/src/features/finance/finance.service.ts` | Adicionar `getCashflow`, `getOverdueInstallments` |
| `server/src/features/finance/finance.controller.ts` | Adicionar `handleGetCashflow`, `handleGetOverdue` |
| `server/src/features/finance/finance.routes.ts` | Registrar GET `/cashflow` e GET `/overdue` |
| `server/src/features/finance/finance.types.ts` | Adicionar `cashflowQuerySchema` |
| `server/src/features/quotes/quotes.service.ts` | Adicionar `duplicateQuote` |
| `server/src/features/quotes/quotes.controller.ts` | Adicionar `handleDuplicateQuote` |
| `server/src/features/quotes/quotes.routes.ts` | Registrar POST `/:id/duplicate` |

### Frontend — criar/modificar
| Arquivo | Mudança |
|---------|---------|
| `client/src/features/finance/api.ts` | Adicionar `getCashflow`, `getOverdueInstallments` |
| `client/src/features/finance/hooks.ts` | Adicionar `useFinanceCashflow`, `useOverdueInstallments`; atualizar `usePayInstallment` |
| `client/src/features/finance/types.ts` | Adicionar `CashflowMonth`, `OverdueInstallment` |
| `client/src/features/finance/CashFlowChart.tsx` | Novo componente |
| `client/src/features/finance/FinanceDashboardPage.tsx` | Integrar CashFlowChart e seção inadimplência |
| `client/src/features/quotes/api.ts` | Adicionar `duplicateQuote` |
| `client/src/features/quotes/hooks.ts` | Adicionar `useDuplicateQuote` |
| `client/src/features/quotes/QuotePDF.tsx` | Novo componente |
| `client/src/features/quotes/QuoteDetailPage.tsx` | Botões PDF e Duplicar |
| `client/src/features/quotes/QuotesListPage.tsx` | Botão Duplicar |

---

## Task 1: Instalar dependências do frontend

**Files:**
- Modify: `client/package.json` (via npm install)

- [ ] **Step 1: Instalar recharts e @react-pdf/renderer**

```bash
cd C:/freela/constru-manager/client
npm install recharts @react-pdf/renderer
```

Expected output: `added N packages` sem erros.

- [ ] **Step 2: Verificar instalação**

```bash
ls node_modules | grep -E "recharts|react-pdf"
```

Expected: `recharts` e `@react-pdf` aparecem.

- [ ] **Step 3: Commit**

```bash
cd C:/freela/constru-manager
git add client/package.json client/package-lock.json
git commit -m "chore: install recharts and @react-pdf/renderer"
```

---

## Task 2: Backend — Cashflow endpoint

**Files:**
- Modify: `server/src/features/finance/finance.service.ts`
- Modify: `server/src/features/finance/finance.types.ts`
- Modify: `server/src/features/finance/finance.controller.ts`
- Modify: `server/src/features/finance/finance.routes.ts`

- [ ] **Step 1: Adicionar schema de validação em `finance.types.ts`**

Adicionar ao final do arquivo `server/src/features/finance/finance.types.ts`:

```typescript
export const cashflowQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export type CashflowQuery = z.infer<typeof cashflowQuerySchema>;
```

- [ ] **Step 2: Adicionar `getCashflow` em `finance.service.ts`**

Adicionar ao final do arquivo `server/src/features/finance/finance.service.ts`:

```typescript
export async function getCashflow(months: number) {
  const now = new Date();
  const results: Array<{ month: number; year: number; income: number; expense: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const transactions = await prisma.cashTransaction.findMany({
      where: { date: { gte: start, lt: end } },
      select: { type: true, amount: true },
    });

    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + t.amount, 0);

    results.push({ month, year, income, expense });
  }

  return results;
}
```

- [ ] **Step 3: Adicionar `handleGetCashflow` em `finance.controller.ts`**

Adicionar ao final do arquivo `server/src/features/finance/finance.controller.ts` (e adicionar `getCashflow` no import do service e `cashflowQuerySchema` no import dos types):

No topo do arquivo, adicionar `getCashflow` ao import do service:
```typescript
import {
  getOpeningBalance,
  updateOpeningBalance,
  getFinanceSummary,
  payInstallment,
  payExpenseLog,
  getCashflow,
} from './finance.service';
```

Adicionar `cashflowQuerySchema` ao import dos types:
```typescript
import { summaryQuerySchema, updateBalanceSchema, cashflowQuerySchema } from './finance.types';
```

Adicionar handler ao final do arquivo:
```typescript
export async function handleGetCashflow(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = cashflowQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getCashflow(parsed.data.months);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 4: Registrar rota em `finance.routes.ts`**

Adicionar `handleGetCashflow` ao import e registrar a rota:

```typescript
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleGetBalance,
  handleUpdateBalance,
  handleGetSummary,
  handlePayInstallment,
  handlePayExpenseLog,
  handleGetCashflow,
} from './finance.controller';

export const financeRouter = Router();

financeRouter.use(authenticate, authorize('ADMIN', 'FINANCE'));

financeRouter.get('/balance', handleGetBalance);
financeRouter.put('/balance', handleUpdateBalance);
financeRouter.get('/summary', handleGetSummary);
financeRouter.get('/cashflow', handleGetCashflow);
financeRouter.patch('/installments/:id/pay', handlePayInstallment);
financeRouter.patch('/expense-logs/:id/pay', handlePayExpenseLog);
```

- [ ] **Step 5: Testar endpoint manualmente**

Com o servidor rodando, executar:
```bash
curl "http://localhost:3000/api/finance/cashflow?months=6" -H "Cookie: <session>"
```

Expected: array de 6 objetos `{ month, year, income, expense }`.

- [ ] **Step 6: Commit**

```bash
cd C:/freela/constru-manager
git add server/src/features/finance/
git commit -m "feat(finance): add cashflow endpoint GET /finance/cashflow"
```

---

## Task 3: Backend — Overdue installments endpoint

**Files:**
- Modify: `server/src/features/finance/finance.service.ts`
- Modify: `server/src/features/finance/finance.controller.ts`
- Modify: `server/src/features/finance/finance.routes.ts`

- [ ] **Step 1: Adicionar `getOverdueInstallments` em `finance.service.ts`**

Adicionar ao final de `server/src/features/finance/finance.service.ts`:

```typescript
export async function getOverdueInstallments() {
  const now = new Date();

  const installments = await prisma.installment.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now },
    },
    include: {
      sale: {
        include: {
          quote: { include: { client: { select: { name: true } } } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  return installments.map((inst) => ({
    id: inst.id,
    clientName: inst.sale.quote.client.name,
    amount: inst.amount,
    dueDate: inst.dueDate.toISOString().slice(0, 10),
    daysOverdue: Math.floor((now.getTime() - inst.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}
```

- [ ] **Step 2: Adicionar `handleGetOverdue` em `finance.controller.ts`**

Atualizar o import do service para incluir `getOverdueInstallments`:

```typescript
import {
  getOpeningBalance,
  updateOpeningBalance,
  getFinanceSummary,
  payInstallment,
  payExpenseLog,
  getCashflow,
  getOverdueInstallments,
} from './finance.service';
```

Adicionar handler ao final do arquivo:

```typescript
export async function handleGetOverdue(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getOverdueInstallments();
    res.json(data);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 3: Registrar rota em `finance.routes.ts`**

Atualizar o arquivo completo:

```typescript
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleGetBalance,
  handleUpdateBalance,
  handleGetSummary,
  handlePayInstallment,
  handlePayExpenseLog,
  handleGetCashflow,
  handleGetOverdue,
} from './finance.controller';

export const financeRouter = Router();

financeRouter.use(authenticate, authorize('ADMIN', 'FINANCE'));

financeRouter.get('/balance', handleGetBalance);
financeRouter.put('/balance', handleUpdateBalance);
financeRouter.get('/summary', handleGetSummary);
financeRouter.get('/cashflow', handleGetCashflow);
financeRouter.get('/overdue', handleGetOverdue);
financeRouter.patch('/installments/:id/pay', handlePayInstallment);
financeRouter.patch('/expense-logs/:id/pay', handlePayExpenseLog);
```

- [ ] **Step 4: Commit**

```bash
cd C:/freela/constru-manager
git add server/src/features/finance/
git commit -m "feat(finance): add overdue installments endpoint GET /finance/overdue"
```

---

## Task 4: Backend — Duplicar orçamento

**Files:**
- Modify: `server/src/features/quotes/quotes.service.ts`
- Modify: `server/src/features/quotes/quotes.controller.ts`
- Modify: `server/src/features/quotes/quotes.routes.ts`

- [ ] **Step 1: Adicionar `duplicateQuote` em `quotes.service.ts`**

Adicionar ao final de `server/src/features/quotes/quotes.service.ts`:

```typescript
export async function duplicateQuote(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      activeVersion: { include: { items: true } },
    },
  })
  if (!quote) return { error: 'NOT_FOUND' as const }
  if (!quote.activeVersion) return { error: 'NO_ACTIVE_VERSION' as const }

  const sourceVersion = quote.activeVersion

  const newQuote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({ data: { clientId: quote.clientId } })
    const version = await tx.quoteVersion.create({
      data: {
        quoteId: created.id,
        version: 1,
        subtotal: sourceVersion.subtotal,
        laborCost: sourceVersion.laborCost,
        discount: sourceVersion.discount,
        total: sourceVersion.total,
        items: {
          create: sourceVersion.items.map((item) => ({
            productId: item.productId,
            kitId: item.kitId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
    })
    return tx.quote.update({
      where: { id: created.id },
      data: { activeVersionId: version.id },
    })
  })

  return { id: newQuote.id }
}
```

- [ ] **Step 2: Adicionar `handleDuplicateQuote` em `quotes.controller.ts`**

Atualizar o import do service:

```typescript
import {
  createQuote,
  listQuotes,
  getQuote,
  addVersion,
  updateStatus,
  acceptQuote,
  duplicateQuote,
} from './quotes.service'
```

Adicionar handler ao final do arquivo:

```typescript
export async function handleDuplicateQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await duplicateQuote(req.params.id as string)
    if ('error' in result) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: result.error, code: result.error })
      return
    }
    res.status(201).json({ id: result.id })
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 3: Registrar rota em `quotes.routes.ts`**

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
  handleDuplicateQuote,
} from './quotes.controller'

export const quotesRouter = Router()

quotesRouter.use(authenticate)

// ADMIN + SALES
quotesRouter.get('/', authorize('ADMIN', 'SALES'), handleListQuotes)
quotesRouter.post('/', authorize('ADMIN', 'SALES'), handleCreateQuote)
quotesRouter.get('/:id', authorize('ADMIN', 'SALES'), handleGetQuote)
quotesRouter.post('/:id/versions', authorize('ADMIN', 'SALES'), handleAddVersion)
quotesRouter.post('/:id/duplicate', authorize('ADMIN', 'SALES'), handleDuplicateQuote)

// ADMIN only
quotesRouter.patch('/:id/status', authorize('ADMIN'), handleUpdateStatus)
quotesRouter.post('/:id/accept', authorize('ADMIN'), handleAcceptQuote)
```

- [ ] **Step 4: Commit**

```bash
cd C:/freela/constru-manager
git add server/src/features/quotes/
git commit -m "feat(quotes): add duplicate quote endpoint POST /quotes/:id/duplicate"
```

---

## Task 5: Frontend — Tipos e API/hooks de finanças

**Files:**
- Modify: `client/src/features/finance/types.ts`
- Modify: `client/src/features/finance/api.ts`
- Modify: `client/src/features/finance/hooks.ts`

- [ ] **Step 1: Adicionar tipos em `finance/types.ts`**

Adicionar ao final de `client/src/features/finance/types.ts`:

```typescript
export interface CashflowMonth {
  month: number;
  year: number;
  income: number;
  expense: number;
}

export interface OverdueInstallment {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}
```

- [ ] **Step 2: Adicionar funções de API em `finance/api.ts`**

Adicionar ao import de types no topo:
```typescript
import type { FinanceSummary, CashflowMonth, OverdueInstallment } from './types';
```

Adicionar ao final do arquivo:
```typescript
export async function getCashflow(months = 6): Promise<CashflowMonth[]> {
  const { data } = await api.get<CashflowMonth[]>(`/finance/cashflow?months=${months}`);
  return data;
}

export async function getOverdueInstallments(): Promise<OverdueInstallment[]> {
  const { data } = await api.get<OverdueInstallment[]>('/finance/overdue');
  return data;
}
```

- [ ] **Step 3: Adicionar hooks em `finance/hooks.ts`**

Atualizar `usePayInstallment` para invalidar todas as queries de finance (incluindo overdue), e adicionar os dois novos hooks. Conteúdo completo do arquivo:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinanceSummary,
  updateBalance,
  payInstallment,
  payExpenseLog,
  getCashflow,
  getOverdueInstallments,
} from './api';

export function useFinanceSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['finance', 'summary', month, year],
    queryFn: () => getFinanceSummary(month, year),
  });
}

export function useFinanceCashflow(months = 6) {
  return useQuery({
    queryKey: ['finance', 'cashflow', months],
    queryFn: () => getCashflow(months),
  });
}

export function useOverdueInstallments() {
  return useQuery({
    queryKey: ['finance', 'overdue'],
    queryFn: getOverdueInstallments,
  });
}

export function useUpdateOpeningBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (openingBalance: number) => updateBalance(openingBalance),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'summary'] }),
  });
}

export function usePayInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payInstallment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function usePayExpenseLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payExpenseLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}
```

- [ ] **Step 4: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/finance/
git commit -m "feat(finance): add cashflow and overdue types, api functions, and hooks"
```

---

## Task 6: Frontend — Componente CashFlowChart

**Files:**
- Create: `client/src/features/finance/CashFlowChart.tsx`

- [ ] **Step 1: Criar `CashFlowChart.tsx`**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useFinanceCashflow } from './hooks';

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                     'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatYAxis(value: number): string {
  if (value === 0) return 'R$ 0';
  if (value >= 100000) return `R$ ${(value / 100000).toFixed(0)}k`;
  return `R$ ${(value / 100).toFixed(0)}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}

export function CashFlowChart() {
  const { data, isLoading } = useFinanceCashflow(6);

  if (isLoading || !data) {
    return (
      <div style={{ padding: 'var(--space-3)', color: 'var(--color-neutral-600)', fontSize: '0.875rem' }}>
        Carregando fluxo de caixa...
      </div>
    );
  }

  const chartData = data.map((d) => ({
    label: `${MONTH_SHORT[d.month - 1]}/${String(d.year).slice(2)}`,
    Entradas: d.income,
    Saídas: d.expense,
  }));

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-neutral-300)',
        borderRadius: 8,
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>Fluxo de Caixa</h2>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} barGap={4} barCategoryGap="30%">
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            formatter={(value: number, name: string) => [formatTooltipValue(value), name]}
          />
          <Legend />
          <Bar dataKey="Entradas" fill="var(--color-success, #16a34a)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Saídas" fill="var(--color-danger, #dc2626)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/finance/CashFlowChart.tsx
git commit -m "feat(finance): add CashFlowChart component using recharts"
```

---

## Task 7: Frontend — Integrar CashFlowChart e seção de inadimplência no dashboard

**Files:**
- Modify: `client/src/features/finance/FinanceDashboardPage.tsx`

- [ ] **Step 1: Adicionar imports no topo de `FinanceDashboardPage.tsx`**

Localizar a linha de imports e adicionar:
```typescript
import { CashFlowChart } from './CashFlowChart';
import { useOverdueInstallments } from './hooks';
```

- [ ] **Step 2: Usar o hook de inadimplência no componente**

Logo após a declaração dos outros hooks (após `payExpenseLogMutation`), adicionar:
```typescript
const { data: overdueData } = useOverdueInstallments();
```

- [ ] **Step 3: Adicionar seção de inadimplência após o seletor de mês**

Logo após o bloco `{/* Header + Month selector */}` (após o `</div>` que fecha o seletor), adicionar:

```tsx
      {/* Overdue installments */}
      {overdueData && overdueData.length > 0 && (
        <div
          style={{
            background: 'var(--color-danger-bg, #fef2f2)',
            border: '1px solid var(--color-danger, #dc2626)',
            borderRadius: 8,
            padding: 'var(--space-2) var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            ⚠ Inadimplência — {overdueData.length} parcela{overdueData.length > 1 ? 's' : ''} vencida{overdueData.length > 1 ? 's' : ''}
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(220,38,38,0.08)', textAlign: 'left' }}>
                {['Cliente', 'Vencimento', 'Dias em atraso', 'Valor', 'Ação'].map((h) => (
                  <th key={h} style={{ padding: '6px 10px', color: 'var(--color-danger)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overdueData.map((inst, i) => (
                <tr
                  key={inst.id}
                  style={{
                    borderTop: '1px solid rgba(220,38,38,0.15)',
                    background: i % 2 === 1 ? 'rgba(220,38,38,0.04)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '6px 10px' }}>{inst.clientName}</td>
                  <td style={{ padding: '6px 10px' }}>{new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--color-danger)', fontWeight: 600 }}>
                    {inst.daysOverdue} dia{inst.daysOverdue !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '6px 10px', fontWeight: 600 }}>{formatCurrency(inst.amount)}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <button
                      onClick={() => void handlePayInstallment(inst.id)}
                      disabled={payingInstallmentId === inst.id}
                      style={{
                        ...btnStyle,
                        background: 'var(--color-danger)',
                        color: '#fff',
                        opacity: payingInstallmentId === inst.id ? 0.6 : 1,
                      }}
                    >
                      {payingInstallmentId === inst.id ? 'Salvando...' : 'Marcar como pago'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
```

- [ ] **Step 4: Adicionar `<CashFlowChart />` após os cards de resumo**

Localizar o comentário `{/* Installments table */}` e adicionar `<CashFlowChart />` logo antes dele:

```tsx
      <CashFlowChart />

      {/* Installments table */}
```

- [ ] **Step 5: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/finance/FinanceDashboardPage.tsx
git commit -m "feat(finance): integrate cashflow chart and overdue section in dashboard"
```

---

## Task 8: Frontend — Componente QuotePDF

**Files:**
- Create: `client/src/features/quotes/QuotePDF.tsx`

- [ ] **Step 1: Criar `QuotePDF.tsx`**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Quote } from './types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a2e',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#1e3a5f',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 9,
    color: '#666',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    borderBottomStyle: 'solid',
  },
  clientRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  clientLabel: {
    width: 80,
    color: '#666',
  },
  clientValue: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    padding: '6 8',
    marginBottom: 0,
  },
  tableHeaderText: {
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '5 8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    backgroundColor: '#f7f9fc',
  },
  colItem: { flex: 3 },
  colQty: { width: 40, textAlign: 'center' },
  colUnit: { width: 50, textAlign: 'right' },
  colTotal: { width: 70, textAlign: 'right' },
  totalsSection: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    marginBottom: 3,
    width: 200,
    justifyContent: 'space-between',
  },
  totalsLabel: {
    color: '#555',
  },
  totalsValue: {
    fontFamily: 'Helvetica-Bold',
  },
  totalFinalRow: {
    flexDirection: 'row',
    width: 200,
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1e3a5f',
    borderTopStyle: 'solid',
  },
  totalFinalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
  },
  totalFinalValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
});

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

interface Props {
  quote: Quote;
}

export function QuotePDF({ quote }: Props) {
  const version = quote.activeVersion!;
  const today = new Date().toLocaleDateString('pt-BR');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>Constru Manager</Text>
          <Text style={styles.headerMeta}>Orçamento gerado em {today}</Text>
        </View>

        {/* Client info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do Cliente</Text>
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>Nome:</Text>
            <Text style={styles.clientValue}>{quote.client.name}</Text>
          </View>
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>Orçamento:</Text>
            <Text style={styles.clientValue}>#{quote.id.slice(-8).toUpperCase()} — Versão {version.version}</Text>
          </View>
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>Data:</Text>
            <Text style={styles.clientValue}>{new Date(quote.createdAt).toLocaleDateString('pt-BR')}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens do Orçamento</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colItem]}>Item</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qtd</Text>
            <Text style={[styles.tableHeaderText, styles.colUnit]}>Unit.</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
          </View>
          {version.items.map((item, i) => (
            <View key={item.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={styles.colItem}>
                {item.product
                  ? `${item.product.name}${item.product.unit ? ` (${item.product.unit})` : ''}`
                  : item.kit?.name ?? '—'}
                {item.kit ? ' [kit]' : ''}
              </Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{fmt(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{fmt(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal:</Text>
            <Text style={styles.totalsValue}>{fmt(version.subtotal)}</Text>
          </View>
          {version.laborCost > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Mão de obra:</Text>
              <Text style={styles.totalsValue}>+ {fmt(version.laborCost)}</Text>
            </View>
          )}
          {version.discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Desconto:</Text>
              <Text style={styles.totalsValue}>- {fmt(version.discount)}</Text>
            </View>
          )}
          <View style={styles.totalFinalRow}>
            <Text style={styles.totalFinalLabel}>TOTAL</Text>
            <Text style={styles.totalFinalValue}>{fmt(version.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Constru Manager · Documento gerado automaticamente em {today}
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/QuotePDF.tsx
git commit -m "feat(quotes): add QuotePDF component using @react-pdf/renderer"
```

---

## Task 9: Frontend — API, hook e UI de duplicar orçamento + botão PDF

**Files:**
- Modify: `client/src/features/quotes/api.ts`
- Modify: `client/src/features/quotes/hooks.ts`
- Modify: `client/src/features/quotes/QuoteDetailPage.tsx`
- Modify: `client/src/features/quotes/QuotesListPage.tsx`

- [ ] **Step 1: Adicionar `duplicateQuote` em `quotes/api.ts`**

Adicionar ao final de `client/src/features/quotes/api.ts`:

```typescript
export async function duplicateQuote(id: string): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/quotes/${id}/duplicate`)
  return data
}
```

- [ ] **Step 2: Adicionar `useDuplicateQuote` em `quotes/hooks.ts`**

Atualizar o import de api para incluir `duplicateQuote`:
```typescript
import {
  listQuotes,
  getQuote,
  createQuote,
  addVersion,
  updateStatus,
  acceptQuote,
  duplicateQuote,
} from './api'
```

Adicionar hook ao final do arquivo:
```typescript
export function useDuplicateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => duplicateQuote(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['quotes'] }) },
  })
}
```

- [ ] **Step 3: Adicionar botões PDF e Duplicar no `QuoteDetailPage.tsx`**

Adicionar ao topo do arquivo (após os imports existentes):
```typescript
import { useNavigate } from '@tanstack/react-router'
import { pdf } from '@react-pdf/renderer'
import { QuotePDF } from './QuotePDF'
import { useDuplicateQuote } from './hooks'
```

Dentro do componente `QuoteDetailPage`, após as declarações de estado existentes, adicionar:
```typescript
  const navigate = useNavigate()
  const duplicateMutation = useDuplicateQuote()

  async function handleDownloadPDF() {
    if (!quote.activeVersion) return
    const blob = await pdf(<QuotePDF quote={quote} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const clientSlug = quote.client.name.replace(/\s+/g, '-').toLowerCase()
    a.download = `orcamento-${clientSlug}-v${quote.activeVersion.version}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDuplicate() {
    const result = await duplicateMutation.mutateAsync(quote.id)
    void navigate({ to: '/quotes/$id', params: { id: result.id } })
  }
```

Localizar o bloco de botões de ação no header (onde estão "Em Análise", "Rejeitar", "Sem Retorno", "Aceitar", "+ Nova Versão") e adicionar após o botão `canAddVersion`:

```tsx
          {quote.activeVersion && (
            <button
              onClick={() => void handleDownloadPDF()}
              style={{
                background: 'var(--color-neutral-100)',
                color: 'var(--color-neutral-700, #374151)',
                border: '1px solid var(--color-neutral-300)',
                padding: '6px var(--space-2)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Baixar PDF
            </button>
          )}
          {(user?.role === 'ADMIN' || user?.role === 'SALES') && (
            <button
              onClick={() => void handleDuplicate()}
              disabled={duplicateMutation.isPending}
              style={{
                background: 'var(--color-neutral-100)',
                color: 'var(--color-neutral-700, #374151)',
                border: '1px solid var(--color-neutral-300)',
                padding: '6px var(--space-2)',
                borderRadius: 4,
                cursor: duplicateMutation.isPending ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: duplicateMutation.isPending ? 0.6 : 1,
              }}
            >
              {duplicateMutation.isPending ? 'Duplicando...' : 'Duplicar'}
            </button>
          )}
```

- [ ] **Step 4: Adicionar botão Duplicar na `QuotesListPage.tsx`**

Adicionar ao topo do arquivo:
```typescript
import { useNavigate } from '@tanstack/react-router'
import { useDuplicateQuote } from './hooks'
```

Dentro do componente, adicionar após `const updateStatusMutation`:
```typescript
  const navigate = useNavigate()
  const duplicateMutation = useDuplicateQuote()

  async function handleDuplicate(id: string) {
    const result = await duplicateMutation.mutateAsync(id)
    void navigate({ to: '/quotes/$id', params: { id: result.id } })
  }
```

Na coluna Ações dentro do `quotes?.map((q, i) => {`, adicionar após o botão "Ver":
```tsx
                      {(user?.role === 'ADMIN' || user?.role === 'SALES') && (
                        <button
                          onClick={() => void handleDuplicate(q.id)}
                          disabled={duplicateMutation.isPending}
                          style={{ ...btnSecondary, opacity: duplicateMutation.isPending ? 0.6 : 1 }}
                        >
                          Duplicar
                        </button>
                      )}
```

- [ ] **Step 5: Commit**

```bash
cd C:/freela/constru-manager
git add client/src/features/quotes/
git commit -m "feat(quotes): add PDF download and duplicate quote UI"
```

---

## Task 10: Verificação final

- [ ] **Step 1: Build do frontend sem erros de TypeScript**

```bash
cd C:/freela/constru-manager/client
npm run build
```

Expected: build completo sem erros de tipo.

- [ ] **Step 2: Verificar manualmente no browser**

Checklist:
- [ ] `/finance` — seção de inadimplência aparece se houver parcelas vencidas
- [ ] `/finance` — gráfico "Fluxo de Caixa" aparece abaixo dos cards
- [ ] `/quotes` — botão "Duplicar" aparece na listagem
- [ ] `/quotes/:id` — botões "Baixar PDF" e "Duplicar" aparecem no detalhe
- [ ] Clicar "Baixar PDF" faz download de arquivo `.pdf`
- [ ] Clicar "Duplicar" cria novo orçamento e navega para ele

- [ ] **Step 3: Commit final**

```bash
cd C:/freela/constru-manager
git add -A
git commit -m "feat: financeiro (cashflow + overdue) e orcamentos (PDF + duplicar) completos"
```
