import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  taxId: z.string().min(1, 'Tax ID is required'),
  nationalId: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
