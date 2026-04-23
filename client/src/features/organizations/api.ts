import { api } from '@/lib/axios'
import type { Organization } from './types'

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
