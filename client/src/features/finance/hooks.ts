import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinanceSummary,
  updateBalance,
  payInstallment,
  payExpenseLog,
  getCashflow,
  getOverdueInstallments,
  getDRE,
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['finance'] });
      void qc.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function usePayExpenseLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payExpenseLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }),
  });
}

export function useFinanceDRE(month: number, year: number) {
  return useQuery({
    queryKey: ['finance', 'dre', month, year],
    queryFn: () => getDRE(month, year),
  });
}
