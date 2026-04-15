import { api } from '@/lib/axios'

export interface User {
  id: string
  email: string
  role: 'ADMIN' | 'SALES' | 'FINANCE'
  isActive: boolean
  createdAt: string
}

export interface RegisterUserPayload {
  email: string
  password: string
  role: 'ADMIN' | 'SALES' | 'FINANCE'
}

export async function getUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/users')
  return data
}

export async function registerUser(payload: RegisterUserPayload): Promise<User> {
  const { data } = await api.post<User>('/auth/register', payload)
  return data
}

export async function deactivateUser(id: string): Promise<User> {
  const { data } = await api.patch<User>(`/users/${id}/deactivate`)
  return data
}
