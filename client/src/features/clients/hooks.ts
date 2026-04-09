import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listClients, getClient, createClient, updateClient, deleteClient } from './api'
import type { CreateClientPayload, UpdateClientPayload } from './types'

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: listClients })
}

export function useClient(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => getClient(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateClientPayload) => createClient(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateClientPayload }) =>
      updateClient(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
