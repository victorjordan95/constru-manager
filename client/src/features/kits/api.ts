import { api } from '@/lib/axios'
import type { Kit, CreateKitPayload, UpdateKitPayload } from './types'

export async function listKits(): Promise<Kit[]> {
  const { data } = await api.get<Kit[]>('/kits')
  return data
}

export async function getKit(id: string): Promise<Kit> {
  const { data } = await api.get<Kit>(`/kits/${id}`)
  return data
}

export async function createKit(payload: CreateKitPayload): Promise<Kit> {
  const { data } = await api.post<Kit>('/kits', payload)
  return data
}

export async function updateKit(id: string, payload: UpdateKitPayload): Promise<Kit> {
  const { data } = await api.put<Kit>(`/kits/${id}`, payload)
  return data
}
