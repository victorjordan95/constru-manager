import { api } from '@/lib/axios'
import type {
  QuoteListItem,
  Quote,
  CreateQuotePayload,
  AddVersionPayload,
  UpdateStatusPayload,
  AcceptQuotePayload,
} from './types'

export async function listQuotes(): Promise<QuoteListItem[]> {
  const { data } = await api.get<QuoteListItem[]>('/quotes')
  return data
}

export async function getQuote(id: string): Promise<Quote> {
  const { data } = await api.get<Quote>(`/quotes/${id}`)
  return data
}

export async function createQuote(payload: CreateQuotePayload): Promise<Quote> {
  const { data } = await api.post<Quote>('/quotes', payload)
  return data
}

export async function addVersion(id: string, payload: AddVersionPayload): Promise<Quote> {
  const { data } = await api.post<Quote>(`/quotes/${id}/versions`, payload)
  return data
}

export async function updateStatus(id: string, payload: UpdateStatusPayload): Promise<Quote> {
  const { data } = await api.patch<Quote>(`/quotes/${id}/status`, payload)
  return data
}

export async function acceptQuote(id: string, payload: AcceptQuotePayload): Promise<Quote> {
  const { data } = await api.post<Quote>(`/quotes/${id}/accept`, payload)
  return data
}
