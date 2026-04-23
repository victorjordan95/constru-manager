import { TransactionType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { DREResponse } from './finance.types';

// ─── Pure helper ──────────────────────────────────────────────────────────────

export function computeBalance(
  openingBalance: number,
  transactions: Array<{ type: TransactionType; amount: number }>,
): number {
  return transactions.reduce(
    (sum, t) => (t.type === 'INCOME' ? sum + t.amount : sum - t.amount),
    openingBalance,
  );
}

// ─── Balance ──────────────────────────────────────────────────────────────────

export async function getOpeningBalance(organizationId: string): Promise<number> {
  const settings = await prisma.financeSettings.findUnique({ where: { organizationId } });
  return settings?.openingBalance ?? 0;
}

export async function updateOpeningBalance(openingBalance: number, organizationId: string): Promise<number> {
  const settings = await prisma.financeSettings.upsert({
    where: { organizationId },
    create: { organizationId, openingBalance },
    update: { openingBalance },
  });
  return settings.openingBalance;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getFinanceSummary(month: number, year: number, organizationId: string) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const activeExpenses = await prisma.fixedExpense.findMany({ where: { isActive: true, organizationId } });
  for (const expense of activeExpenses) {
    await prisma.fixedExpenseLog.upsert({
      where: { fixedExpenseId_month_year: { fixedExpenseId: expense.id, month, year } },
      create: { fixedExpenseId: expense.id, month, year, status: 'PENDING' },
      update: {},
    });
  }

  const openingBalance = await getOpeningBalance(organizationId);
  const allTransactions = await prisma.cashTransaction.findMany({
    where: {
      OR: [
        { installment: { sale: { quote: { organizationId } } } },
        { fixedExpenseLog: { fixedExpense: { organizationId } } },
      ],
    },
    select: { type: true, amount: true },
  });
  const balance = computeBalance(openingBalance, allTransactions);

  const installments = await prisma.installment.findMany({
    where: { dueDate: { gte: monthStart, lt: monthEnd }, sale: { quote: { organizationId } } },
    include: {
      sale: { include: { quote: { include: { client: { select: { name: true } } } } } },
    },
    orderBy: { dueDate: 'asc' },
  });

  const expenseLogs = await prisma.fixedExpenseLog.findMany({
    where: { month, year, fixedExpense: { organizationId } },
    include: { fixedExpense: { select: { name: true, category: true, dueDay: true, amount: true } } },
    orderBy: { fixedExpense: { dueDay: 'asc' } },
  });

  const incoming = installments.filter((i) => i.status !== 'PAID').reduce((s, i) => s + i.amount, 0);
  const outgoing = expenseLogs.filter((l) => l.status === 'PENDING').reduce((s, l) => s + l.fixedExpense.amount, 0);

  const monthTransactions = await prisma.cashTransaction.findMany({
    where: {
      date: { gte: monthStart, lt: monthEnd },
      OR: [
        { installment: { sale: { quote: { organizationId } } } },
        { fixedExpenseLog: { fixedExpense: { organizationId } } },
      ],
    },
    select: { type: true, amount: true },
  });
  const paidIncome = monthTransactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const paidExpense = monthTransactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const netProfit = paidIncome - paidExpense;

  return {
    balance,
    openingBalance,
    month,
    year,
    projected: { incoming, outgoing },
    realized: { netProfit },
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
  };
}

// ─── Pay installment ──────────────────────────────────────────────────────────

export async function payInstallment(id: string, organizationId: string) {
  const installment = await prisma.installment.findFirst({
    where: { id, sale: { quote: { organizationId } } },
    include: {
      sale: { include: { quote: { include: { client: { select: { name: true } } } } } },
    },
  });
  if (!installment) return { error: 'NOT_FOUND' as const };
  if (installment.status === 'PAID') return { error: 'ALREADY_PAID' as const };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.installment.update({ where: { id }, data: { status: 'PAID', paidAt: now } });
    await tx.cashTransaction.create({
      data: {
        type: 'INCOME',
        amount: installment.amount,
        date: now,
        origin: 'INSTALLMENT',
        description: installment.sale.quote.client.name,
        installmentId: id,
      },
    });
  });

  const updated = await prisma.installment.findUnique({ where: { id } });
  return { installment: updated };
}

// ─── Cashflow ─────────────────────────────────────────────────────────────────

export async function getCashflow(months: number, organizationId: string) {
  const now = new Date();
  const results: Array<{ month: number; year: number; income: number; expense: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const transactions = await prisma.cashTransaction.findMany({
      where: {
        date: { gte: start, lt: end },
        OR: [
          { installment: { sale: { quote: { organizationId } } } },
          { fixedExpenseLog: { fixedExpense: { organizationId } } },
        ],
      },
      select: { type: true, amount: true },
    });

    const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    results.push({ month, year, income, expense });
  }

  return results;
}

// ─── Overdue installments ─────────────────────────────────────────────────────

export async function getOverdueInstallments(organizationId: string) {
  const now = new Date();

  const installments = await prisma.installment.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now },
      sale: { quote: { organizationId } },
    },
    include: {
      sale: { include: { quote: { include: { client: { select: { name: true } } } } } },
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

// ─── Pay expense log ──────────────────────────────────────────────────────────

export async function payExpenseLog(id: string, organizationId: string) {
  const log = await prisma.fixedExpenseLog.findFirst({
    where: { id, fixedExpense: { organizationId } },
    include: { fixedExpense: { select: { name: true, amount: true } } },
  });
  if (!log) return { error: 'NOT_FOUND' as const };
  if (log.status === 'PAID') return { error: 'ALREADY_PAID' as const };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.fixedExpenseLog.update({ where: { id }, data: { status: 'PAID', paidAt: now } });
    await tx.cashTransaction.create({
      data: {
        type: 'EXPENSE',
        amount: log.fixedExpense.amount,
        date: now,
        origin: 'FIXED_EXPENSE',
        description: log.fixedExpense.name,
        fixedExpenseLogId: id,
      },
    });
  });

  const updated = await prisma.fixedExpenseLog.findUnique({ where: { id } });
  return { log: updated };
}

// ─── DRE ──────────────────────────────────────────────────────────────────────

export async function getDRE(month: number, year: number, organizationId: string): Promise<DREResponse> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month,     1);

  const activeExpenses = await prisma.fixedExpense.findMany({ where: { isActive: true, organizationId } });
  for (const expense of activeExpenses) {
    await prisma.fixedExpenseLog.upsert({
      where: { fixedExpenseId_month_year: { fixedExpenseId: expense.id, month, year } },
      create: { fixedExpenseId: expense.id, month, year, status: 'PENDING' },
      update: {},
    });
  }

  const [installments, expenseLogs, incomeTransactions, expenseTransactions] = await Promise.all([
    prisma.installment.findMany({
      where: { dueDate: { gte: monthStart, lt: monthEnd }, status: { not: 'PAID' }, sale: { quote: { organizationId } } },
      select: { amount: true },
    }),
    prisma.fixedExpenseLog.findMany({
      where: { month, year, status: 'PENDING', fixedExpense: { organizationId } },
      include: { fixedExpense: { select: { amount: true, category: true } } },
    }),
    prisma.cashTransaction.findMany({
      where: {
        type: 'INCOME',
        date: { gte: monthStart, lt: monthEnd },
        installment: { sale: { quote: { organizationId } } },
      },
      select: { amount: true },
    }),
    prisma.cashTransaction.findMany({
      where: {
        type: 'EXPENSE',
        date: { gte: monthStart, lt: monthEnd },
        fixedExpenseLog: { fixedExpense: { organizationId } },
      },
      include: {
        fixedExpenseLog: { include: { fixedExpense: { select: { category: true } } } },
      },
    }),
  ]);

  const receitaPrevista  = installments.reduce((s, i) => s + i.amount, 0);
  const despesaPrevista  = expenseLogs.reduce((s, l) => s + l.fixedExpense.amount, 0);
  const receitaRealizada = incomeTransactions.reduce((s, t) => s + t.amount, 0);
  const despesaRealizada = expenseTransactions.reduce((s, t) => s + t.amount, 0);

  const prevMap = new Map<string | null, number>();
  for (const log of expenseLogs) {
    const cat = log.fixedExpense.category ?? null;
    prevMap.set(cat, (prevMap.get(cat) ?? 0) + log.fixedExpense.amount);
  }

  const realMap = new Map<string | null, number>();
  for (const tx of expenseTransactions) {
    const cat = tx.fixedExpenseLog?.fixedExpense.category ?? null;
    realMap.set(cat, (realMap.get(cat) ?? 0) + tx.amount);
  }

  const allCategories = new Set([...prevMap.keys(), ...realMap.keys()]);
  const expensesByCategory = [...allCategories]
    .sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    .map((category) => ({
      category,
      previsto:  prevMap.get(category)  ?? 0,
      realizado: realMap.get(category) ?? 0,
    }));

  return {
    month,
    year,
    receitaPrevista,
    receitaRealizada,
    despesaPrevista,
    despesaRealizada,
    resultadoPrevisto:  receitaPrevista  - despesaPrevista,
    resultadoRealizado: receitaRealizada - despesaRealizada,
    expensesByCategory,
  };
}
