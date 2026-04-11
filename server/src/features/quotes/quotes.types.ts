import { z } from 'zod'

export const quoteItemInputSchema = z
  .object({
    productId: z.string().optional(),
    kitId: z.string().optional(),
    quantity: z.number().int().min(1, 'quantity must be at least 1'),
  })
  .refine((d) => Boolean(d.productId) !== Boolean(d.kitId), {
    message: 'Exactly one of productId or kitId must be provided',
  })

export const createQuoteSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  items: z.array(quoteItemInputSchema).min(1, 'Quote must have at least one item'),
  laborCost: z.number().int().min(0).default(0),
  discount: z.number().int().min(0).default(0),
})

export const addVersionSchema = z.object({
  items: z.array(quoteItemInputSchema).min(1, 'Version must have at least one item'),
  laborCost: z.number().int().min(0).default(0),
  discount: z.number().int().min(0).default(0),
})

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING_REVIEW', 'REJECTED', 'NO_RESPONSE']),
})

export const installmentInputSchema = z.object({
  dueDate: z.string().datetime(),
  amount: z.number().int().min(1),
})

export const acceptQuoteSchema = z.object({
  paymentType: z.enum(['LUMP_SUM', 'INSTALLMENTS']),
  downPayment: z.number().int().min(0).default(0),
  installments: z.array(installmentInputSchema).optional(),
})

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type AddVersionInput = z.infer<typeof addVersionSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type InstallmentInput = z.infer<typeof installmentInputSchema>
export type AcceptQuoteInput = z.infer<typeof acceptQuoteSchema>
