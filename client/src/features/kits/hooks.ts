import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listKits, getKit, createKit, updateKit } from './api'
import type { CreateKitPayload, UpdateKitPayload } from './types'

export function useKits() {
  return useQuery({ queryKey: ['kits'], queryFn: listKits })
}

export function useKit(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['kits', id],
    queryFn: () => getKit(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateKitPayload) => createKit(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kits'] }),
  })
}

export function useUpdateKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateKitPayload }) =>
      updateKit(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kits'] }),
  })
}
