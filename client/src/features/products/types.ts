export interface Product {
  id: string
  name: string
  basePrice: number      // cents (integer)
  markupPercent: number  // Prisma Decimal serialized as number
  finalPrice: number     // cents (integer), auto-computed by server
  unit: string | null
  minStock: number
  stockQty: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProductPayload {
  name: string
  basePrice: number      // cents
  markupPercent: number  // 0–99999.99
  unit?: string
  minStock?: number
  stockQty?: number
}

export type UpdateProductPayload = Partial<CreateProductPayload>
