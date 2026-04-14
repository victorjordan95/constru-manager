import { api } from '@/lib/axios';
import type { FixedExpense, CreateFixedExpensePayload, UpdateFixedExpensePayload } from './types';

export async function listFixedExpenses(): Promise<FixedExpense[]> {
  const { data } = await api.get<FixedExpense[]>('/fixed-expenses');
  return data;
}

export async function getFixedExpense(id: string): Promise<FixedExpense> {
  const { data } = await api.get<FixedExpense>(`/fixed-expenses/${id}`);
  return data;
}

export async function createFixedExpense(payload: CreateFixedExpensePayload): Promise<FixedExpense> {
  const { data } = await api.post<FixedExpense>('/fixed-expenses', payload);
  return data;
}

export async function updateFixedExpense(
  id: string,
  payload: UpdateFixedExpensePayload,
): Promise<FixedExpense> {
  const { data } = await api.put<FixedExpense>(`/fixed-expenses/${id}`, payload);
  return data;
}

export async function deleteFixedExpense(id: string): Promise<void> {
  await api.delete(`/fixed-expenses/${id}`);
}
