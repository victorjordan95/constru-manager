import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listOrganizations, createOrganization, createAdminForOrg } from './api'

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
