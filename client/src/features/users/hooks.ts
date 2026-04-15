import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, registerUser, deactivateUser } from './api'
import type { RegisterUserPayload } from './api'

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: getUsers })
}

export function useRegisterUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RegisterUserPayload) => registerUser(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}
