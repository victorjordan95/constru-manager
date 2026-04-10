export interface KitItem {
  id: string
  productId: string
  quantity: number
  product: {
    id: string
    name: string
    finalPrice: number
    unit: string | null
  }
}

export interface Kit {
  id: string
  name: string
  totalPrice: number   // cents, sum of (item.product.finalPrice * item.quantity)
  isActive: boolean
  items: KitItem[]
  createdAt: string
  updatedAt: string
}

export interface KitItemPayload {
  productId: string
  quantity: number
}

export interface CreateKitPayload {
  name: string
  items: KitItemPayload[]   // min 1 item
}

export interface UpdateKitPayload {
  name?: string
  items?: KitItemPayload[]  // replaces all items when provided
}
