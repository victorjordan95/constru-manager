import { z } from 'zod';

export const summaryQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const updateBalanceSchema = z.object({
  openingBalance: z.number().int().min(0),
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type UpdateBalanceInput = z.infer<typeof updateBalanceSchema>;

export const cashflowQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export type CashflowQuery = z.infer<typeof cashflowQuerySchema>;
