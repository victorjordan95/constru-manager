import { api } from '@/lib/axios'
import type { Client, CreateClientPayload, UpdateClientPayload } from './types'

export async function listClients(): Promise<Client[]> {
  const { data } = await api.get<Client[]>('/clients')
  return data
}

export async function getClient(id: string): Promise<Client> {
  const { data } = await api.get<Client>(`/clients/${id}`)
  return data
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const { data } = await api.post<Client>('/clients', payload)
  return data
}

export async function updateClient(id: string, payload: UpdateClientPayload): Promise<Client> {
  const { data } = await api.put<Client>(`/clients/${id}`, payload)
  return data
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/clients/${id}`)
}
