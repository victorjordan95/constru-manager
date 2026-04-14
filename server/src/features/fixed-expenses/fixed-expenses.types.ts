import { z } from 'zod';

export const createFixedExpenseSchema = z.object({
  name: z.string().min(1, 'name is required'),
  amount: z.number().int().min(1, 'amount must be at least 1'),
  dueDay: z.number().int().min(1).max(28, 'dueDay must be between 1 and 28'),
  category: z.string().optional(),
});

export const updateFixedExpenseSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().int().min(1).optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
  category: z.string().optional(),
});

export type CreateFixedExpenseInput = z.infer<typeof createFixedExpenseSchema>;
export type UpdateFixedExpenseInput = z.infer<typeof updateFixedExpenseSchema>;
