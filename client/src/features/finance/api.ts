import { api } from '@/lib/axios';
import type { FinanceSummary, CashflowMonth, OverdueInstallment } from './types';

export async function getFinanceSummary(month: number, year: number): Promise<FinanceSummary> {
  const { data } = await api.get<FinanceSummary>(`/finance/summary?month=${month}&year=${year}`);
  return data;
}

export async function getBalance(): Promise<{ openingBalance: number }> {
  const { data } = await api.get<{ openingBalance: number }>('/finance/balance');
  return data;
}

export async function updateBalance(openingBalance: number): Promise<{ openingBalance: number }> {
  const { data } = await api.put<{ openingBalance: number }>('/finance/balance', { openingBalance });
  return data;
}

export async function payInstallment(id: string): Promise<void> {
  await api.patch(`/finance/installments/${id}/pay`);
}

export async function payExpenseLog(id: string): Promise<void> {
  await api.patch(`/finance/expense-logs/${id}/pay`);
}

export async function getCashflow(months = 6): Promise<CashflowMonth[]> {
  const { data } = await api.get<CashflowMonth[]>(`/finance/cashflow?months=${months}`);
  return data;
}

export async function getOverdueInstallments(): Promise<OverdueInstallment[]> {
  const { data } = await api.get<OverdueInstallment[]>('/finance/overdue');
  return data;
}
