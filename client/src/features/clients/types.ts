export interface Client {
  id: string
  name: string
  taxId: string
  nationalId: string | null
  address: string | null
  zipCode: string | null
  email: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateClientPayload {
  name: string
  taxId: string
  nationalId?: string
  address?: string
  zipCode?: string
  email?: string
  phone?: string
}

export type UpdateClientPayload = Partial<CreateClientPayload>
