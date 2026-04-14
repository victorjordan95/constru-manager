import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFinanceSummary, updateBalance, payInstallment, payExpenseLog } from './api';

export function useFinanceSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['finance', 'summary', month, year],
    queryFn: () => getFinanceSummary(month, year),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'summary'] }),
  });
}

export function usePayExpenseLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payExpenseLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', 'summary'] }),
  });
}
