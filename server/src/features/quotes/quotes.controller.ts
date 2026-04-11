import { Request, Response, NextFunction } from 'express'
import {
  createQuote,
  listQuotes,
  getQuote,
  addVersion,
  updateStatus,
  acceptQuote,
} from './quotes.service'
import {
  createQuoteSchema,
  addVersionSchema,
  updateStatusSchema,
  acceptQuoteSchema,
} from './quotes.types'

export async function handleCreateQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createQuoteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await createQuote(parsed.data)
    if ('error' in result) {
      res.status(400).json({ error: result.error, code: result.error })
      return
    }
    res.status(201).json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleListQuotes(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listQuotes())
  } catch (err) {
    next(err)
  }
}

export async function handleGetQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getQuote(req.params.id as string)
    if ('error' in result) {
      res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleAddVersion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = addVersionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await addVersion(req.params.id as string, parsed.data)
    if ('error' in result) {
      const code = result.error
      const status = code === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: code, code })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleUpdateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await updateStatus(req.params.id as string, parsed.data)
    if ('error' in result) {
      res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}

export async function handleAcceptQuote(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = acceptQuoteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await acceptQuote(req.params.id as string, parsed.data)
    if ('error' in result) {
      const code = result.error
      const status = code === 'NOT_FOUND' ? 404 : 400
      res.status(status).json({ error: code, code })
      return
    }
    res.json(result.quote)
  } catch (err) {
    next(err)
  }
}
