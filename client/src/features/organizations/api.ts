import { api } from '@/lib/axios'
import type { Organization, CurrentOrganization } from './types'

export async function listOrganizations(): Promise<Organization[]> {
  const { data } = await api.get<Organization[]>('/organizations')
  return data
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data } = await api.post<Organization>('/organizations', { name })
  return data
}

export async function createAdminForOrg(orgId: string, email: string, password: string): Promise<void> {
  await api.post(`/organizations/${orgId}/admin`, { email, password })
}

export async function getCurrentOrganization(): Promise<CurrentOrganization> {
  const { data } = await api.get<CurrentOrganization>('/organizations/current')
  return data
}

export async function uploadOrgLogo(id: string, file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData()
  formData.append('logo', file)
  const { data } = await api.post<{ logoUrl: string }>(`/organizations/${id}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
