import { Request, Response, NextFunction } from 'express'
import {
  createQuote,
  listQuotes,
  getQuote,
  addVersion,
  updateStatus,
  acceptQuote,
  duplicateQuote,
} from './quotes.service'
import {
  createQuoteSchema,
  addVersionSchema,
  updateStatusSchema,
  acceptQuoteSchema,
} from './quotes.types'
import { AuthenticatedRequest } from '../auth/auth.types'

export async function handleCreateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user
    const parsed = createQuoteSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return }
    const result = await createQuote({ ...parsed.data, organizationId: organizationId! })
    if ('error' in result) { res.status(400).json({ error: result.error, code: result.error }); return }
    res.status(201).json(result.quote)
  } catch (err) { next(err) }
}

export async function handleListQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user
    res.json(await listQuotes(organizationId!))
  } catch (err) { next(err) }
}

export async function handleGetQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user
    const result = await getQuote(req.params.id as string, organizationId!)
    if ('error' in result) { res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' }); return }
    res.json(result.quote)
  } catch (err) { next(err) }
}

export async function handleAddVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user
    const parsed = addVersionSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return }
    const result = await addVersion(req.params.id as string, organizationId!, parsed.data)
    if ('error' in result) {
      const code = result.error
      const status = code === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: code, code }); return
    }
    res.json(result.quote)
  } catch (err) { next(err) }
}

export async function handleUpdateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return }
    const result = await updateStatus(req.params.id as string, organizationId!, parsed.data)
    if ('error' in result) { res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' }); return }
    res.json(result.quote)
  } catch (err) { next(err) }
}

export async function handleDuplicateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user
    const result = await duplicateQuote(req.params.id as string, organizationId!)
    if ('error' in result) {
      const status = result.error === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: result.error, code: result.error }); return
    }
    res.status(201).json({ id: result.id })
  } catch (err) { next(err) }
}

export async function handleAcceptQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user
    const parsed = acceptQuoteSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return }
    const result = await acceptQuote(req.params.id as string, organizationId!, parsed.data)
    if ('error' in result) {
      const code = result.error
      const status = code === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: code, code }); return
    }
    res.json({ quote: result.quote, stockWarnings: result.stockWarnings })
  } catch (err) { next(err) }
}
