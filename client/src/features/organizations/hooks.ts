import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import {
  listOrganizations,
  createOrganization,
  createAdminForOrg,
  getCurrentOrganization,
  uploadOrgLogo,
} from './api'

export function useOrganizations(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['organizations'], queryFn: listOrganizations, enabled: options?.enabled ?? true })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createOrganization(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations'] }),
  })
}

export function useCreateAdmin() {
  return useMutation({
    mutationFn: ({ orgId, email, password }: { orgId: string; email: string; password: string }) =>
      createAdminForOrg(orgId, email, password),
  })
}

export function useCurrentOrganization() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['organization', 'current'],
    queryFn: getCurrentOrganization,
    enabled: Boolean(user) && user?.role !== 'SUPER_ADMIN',
    staleTime: 5 * 60 * 1000,
  })
}

export function useUploadOrgLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadOrgLogo(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization', 'current'] }),
  })
}
