# DRE — Demonstrativo de Resultado do Exercício

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma página `/dre` que exibe o Demonstrativo de Resultado do Exercício mês a mês, com colunas Previsto e Realizado, usando exclusivamente dados já existentes no banco.

**Architecture:** Novo endpoint `GET /finance/dre` no backend agrega dados de `Installment`, `FixedExpenseLog` e `CashTransaction`. Frontend adiciona rota `/dre` com página dedicada e hook próprio. Nenhuma mudança de schema.

**Tech Stack:** Express + Prisma (backend), React + TanStack Query + TanStack Router (frontend), inline styles seguindo padrão do projeto.

---

## Dados e Fontes

| Linha DRE | Previsto | Realizado |
|---|---|---|
| Receita de Vendas | `Installment.amount` com `dueDate` no mês (todos os status) | `CashTransaction` com `type = INCOME` e `date` no mês |
| Despesas (por categoria) | `FixedExpenseLog` do mês × `FixedExpense.amount` (todos os status) | `CashTransaction` com `type = EXPENSE` e `date` no mês, agrupadas por categoria via `FixedExpenseLog → FixedExpense.category` |
| Total Despesas | Soma das despesas previstas | Soma das despesas realizadas |
| Resultado do Mês | Receita Prev. − Total Despesas Prev. | Receita Real. − Total Despesas Real. |

**Nota sobre despesas realizadas por categoria:** `CashTransaction` do tipo EXPENSE tem `fixedExpenseLogId`. Para agrupar por categoria, o endpoint faz join `CashTransaction → FixedExpenseLog → FixedExpense.category`.

---

## Backend

### Endpoint

```
GET /finance/dre?month=4&year=2026
```

Acesso: roles `ADMIN` e `FINANCE` (mesma guarda do `/finance/summary`).

### Resposta

```json
{
  "month": 4,
  "year": 2026,
  "receitaPrevista": 120000,
  "receitaRealizada": 80000,
  "despesaPrevista": 275000,
  "despesaRealizada": 235000,
  "resultadoPrevisto": -155000,
  "resultadoRealizado": -155000,
  "expensesByCategory": [
    { "category": "Aluguel", "previsto": 200000, "realizado": 200000 },
    { "category": "Energia", "previsto": 50000, "realizado": 35000 },
    { "category": null, "previsto": 25000, "realizado": 0 }
  ]
}
```

Todos os valores em centavos (inteiros). `category: null` representa despesas sem categoria.

### Lógica de agregação (finance.service.ts)

```typescript
export async function getDRE(month: number, year: number) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 1);

  // Receita prevista: todas as parcelas com dueDate no mês
  const installments = await prisma.installment.findMany({
    where: { dueDate: { gte: monthStart, lt: monthEnd } },
    select: { amount: true },
  });
  const receitaPrevista = installments.reduce((s, i) => s + i.amount, 0);

  // Despesas previstas: FixedExpenseLogs do mês com seus valores
  const expenseLogs = await prisma.fixedExpenseLog.findMany({
    where: { month, year },
    include: { fixedExpense: { select: { amount: true, category: true } } },
  });
  const despesaPrevista = expenseLogs.reduce((s, l) => s + l.fixedExpense.amount, 0);

  // Receita realizada: CashTransactions INCOME no mês
  const incomeTransactions = await prisma.cashTransaction.findMany({
    where: { type: 'INCOME', date: { gte: monthStart, lt: monthEnd } },
    select: { amount: true },
  });
  const receitaRealizada = incomeTransactions.reduce((s, t) => s + t.amount, 0);

  // Despesas realizadas: CashTransactions EXPENSE no mês com categoria via join
  const expenseTransactions = await prisma.cashTransaction.findMany({
    where: { type: 'EXPENSE', date: { gte: monthStart, lt: monthEnd } },
    include: {
      fixedExpenseLog: { include: { fixedExpense: { select: { category: true } } } },
    },
  });
  const despesaRealizada = expenseTransactions.reduce((s, t) => s + t.amount, 0);

  // Agrupar despesas previstas por categoria
  const prevMap = new Map<string | null, number>();
  for (const log of expenseLogs) {
    const cat = log.fixedExpense.category ?? null;
    prevMap.set(cat, (prevMap.get(cat) ?? 0) + log.fixedExpense.amount);
  }

  // Agrupar despesas realizadas por categoria
  const realMap = new Map<string | null, number>();
  for (const tx of expenseTransactions) {
    const cat = tx.fixedExpenseLog?.fixedExpense.category ?? null;
    realMap.set(cat, (realMap.get(cat) ?? 0) + tx.amount);
  }

  // Unir categorias
  const allCategories = new Set([...prevMap.keys(), ...realMap.keys()]);
  const expensesByCategory = [...allCategories].map((category) => ({
    category,
    previsto: prevMap.get(category) ?? 0,
    realizado: realMap.get(category) ?? 0,
  }));

  return {
    month, year,
    receitaPrevista,
    receitaRealizada,
    despesaPrevista,
    despesaRealizada,
    resultadoPrevisto: receitaPrevista - despesaPrevista,
    resultadoRealizado: receitaRealizada - despesaRealizada,
    expensesByCategory,
  };
}
```

### Arquivos modificados no backend

- `server/src/features/finance/finance.service.ts` — adicionar `getDRE`
- `server/src/features/finance/finance.controller.ts` — adicionar handler `getDre`
- `server/src/features/finance/finance.routes.ts` — adicionar `GET /dre`
- `server/src/features/finance/finance.types.ts` — adicionar tipo `DREResponse`

---

## Frontend

### Arquivos

| Arquivo | Ação |
|---|---|
| `client/src/features/finance/api.ts` | Adicionar `getDRE(month, year)` |
| `client/src/features/finance/hooks.ts` | Adicionar `useFinanceDRE(month, year)` |
| `client/src/features/finance/DrePage.tsx` | Criar página DRE |
| `client/src/router/index.tsx` | Adicionar `dreRoute` e incluir no `routeTree` |
| `client/src/layouts/AppLayout.tsx` | Adicionar link "DRE" visível para ADMIN e FINANCE |

### Layout da página

```
┌──────────────────────────────────────────────────────────┐
│  DRE — Abril / 2026                [◄]  Abr 2026  [►]   │
├──────────────────────────────────┬───────────┬───────────┤
│                                  │ Previsto  │ Realizado │
├──────────────────────────────────┼───────────┼───────────┤
│ RECEITAS                         │           │           │
│   Receita de Vendas              │ R$ 1.200  │ R$ 800    │
├──────────────────────────────────┼───────────┼───────────┤
│ DESPESAS                         │           │           │
│   Aluguel                        │ R$ 2.000  │ R$ 2.000  │
│   Energia                        │ R$   500  │ R$   350  │
│   Outros (sem categoria)         │ R$   250  │ R$     0  │
│   Total Despesas                 │ R$ 2.750  │ R$ 2.350  │
├──────────────────────────────────┼───────────┼───────────┤
│ RESULTADO DO MÊS                 │ -R$ 1.550 │ -R$ 1.550 │
│                                  │ (vermelho)│ (vermelho)│
└──────────────────────────────────┴───────────┴───────────┘
```

**Seletor de mês:** botões `◄` / `►` com label "Mês AAAA" entre eles, igual ao padrão do `FinanceDashboardPage`. Estado local `[month, year]`, inicializa no mês atual.

**Cores do Resultado:**
- Positivo → `var(--color-success)`
- Negativo → `var(--color-danger)`
- Zero → `var(--color-neutral-600)`

**Categoria nula:** exibida como "Outros" na tabela.

**Acessos:** rota protegida, link no nav visível apenas para `ADMIN` e `FINANCE`.

---

## Restrições e Decisões

- **Sem novo modelo de banco** — usa apenas dados já existentes.
- **Despesas realizadas sem categoria** (`fixedExpenseLogId = null`): transações manuais futuras cairiam em "Outros". Por ora, todas as despesas EXPENSE vêm de `FixedExpenseLog`, então sempre têm categoria disponível via join.
- **YAGNI:** sem gráfico, sem exportação PDF, sem comparativo entre meses. Pode ser adicionado depois.
