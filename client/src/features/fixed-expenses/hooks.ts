import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listFixedExpenses,
  getFixedExpense,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
} from './api';
import type { CreateFixedExpensePayload, UpdateFixedExpensePayload } from './types';

export function useFixedExpenses() {
  return useQuery({ queryKey: ['fixed-expenses'], queryFn: listFixedExpenses });
}

export function useFixedExpense(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['fixed-expenses', id],
    queryFn: () => getFixedExpense(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  });
}

export function useCreateFixedExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFixedExpensePayload) => createFixedExpense(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-expenses'] }),
  });
}

export function useUpdateFixedExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFixedExpensePayload }) =>
      updateFixedExpense(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-expenses'] }),
  });
}

export function useDeleteFixedExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFixedExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed-expenses'] }),
  });
}
