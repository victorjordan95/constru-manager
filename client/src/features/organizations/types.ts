export interface Organization {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  logoUrl?: string | null
}

export interface CurrentOrganization {
  id: string
  name: string
  logoUrl: string | null
}
