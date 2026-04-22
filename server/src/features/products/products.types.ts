import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  basePrice: z.number().int().min(0, 'basePrice must be a non-negative integer (cents)'),
  markupPercent: z.number().min(0).max(99999.99),
  unit: z.string().optional(),
  minStock: z.number().int().min(0).optional(),
  stockQty: z.number().int().min(0).optional(),
});

// finalPrice is auto-computed, not accepted from client
export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
