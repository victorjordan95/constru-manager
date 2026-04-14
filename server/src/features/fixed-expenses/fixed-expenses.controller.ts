import { Request, Response, NextFunction } from 'express'
import {
  listFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  softDeleteFixedExpense,
} from './fixed-expenses.service'
import { createFixedExpenseSchema, updateFixedExpenseSchema } from './fixed-expenses.types'

export async function handleListFixedExpenses(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listFixedExpenses())
  } catch (err) {
    next(err)
  }
}

export async function handleCreateFixedExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createFixedExpenseSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    res.status(201).json(await createFixedExpense(parsed.data))
  } catch (err) {
    next(err)
  }
}

export async function handleUpdateFixedExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateFixedExpenseSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    const result = await updateFixedExpense(req.params.id as string, parsed.data)
    if (!result) {
      res.status(404).json({ error: 'Fixed expense not found', code: 'NOT_FOUND' })
      return
    }
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export async function handleDeleteFixedExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ok = await softDeleteFixedExpense(req.params.id as string)
    if (!ok) {
      res.status(404).json({ error: 'Fixed expense not found', code: 'NOT_FOUND' })
      return
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
