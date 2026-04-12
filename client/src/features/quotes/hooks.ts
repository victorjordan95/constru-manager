import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listQuotes,
  getQuote,
  createQuote,
  addVersion,
  updateStatus,
  acceptQuote,
} from './api'
import type {
  CreateQuotePayload,
  AddVersionPayload,
  UpdateStatusPayload,
  AcceptQuotePayload,
} from './types'

export function useQuotes() {
  return useQuery({ queryKey: ['quotes'], queryFn: listQuotes })
}

export function useQuote(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: () => getQuote(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateQuotePayload) => createQuote(payload),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['quotes'] }) },
  })
}

export function useAddVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AddVersionPayload }) =>
      addVersion(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['quotes', id] })
      void qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStatusPayload }) =>
      updateStatus(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['quotes', id] })
      void qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useAcceptQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AcceptQuotePayload }) =>
      acceptQuote(id, payload),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['quotes', id] })
      void qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}
