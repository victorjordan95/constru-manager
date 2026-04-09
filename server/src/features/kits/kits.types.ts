import { z } from 'zod';

export const kitItemInputSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int().min(1, 'quantity must be at least 1'),
});

export const createKitSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  items: z.array(kitItemInputSchema).min(1, 'Kit must have at least one item'),
});

export const updateKitSchema = z.object({
  name: z.string().min(1).optional(),
  items: z.array(kitItemInputSchema).min(1).optional(),
});

export type KitItemInput = z.infer<typeof kitItemInputSchema>;
export type CreateKitInput = z.infer<typeof createKitSchema>;
export type UpdateKitInput = z.infer<typeof updateKitSchema>;
