import type { QuoteStatus } from './types'

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_REVIEW: 'Em Análise',
  ACCEPTED: 'Aceito',
  REJECTED: 'Rejeitado',
  NO_RESPONSE: 'Sem Retorno',
}

export const STATUS_COLOR: Record<QuoteStatus, { bg: string; text: string }> = {
  DRAFT: { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-600)' },
  PENDING_REVIEW: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  ACCEPTED: { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  REJECTED: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger)' },
  NO_RESPONSE: { bg: 'var(--color-neutral-300)', text: 'var(--color-neutral-600)' },
}
