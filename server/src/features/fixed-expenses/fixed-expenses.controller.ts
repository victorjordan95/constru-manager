import { Request, Response, NextFunction } from 'express';
import {
  listFixedExpenses,
  getFixedExpense,
  createFixedExpense,
  updateFixedExpense,
  softDeleteFixedExpense,
} from './fixed-expenses.service';
import { createFixedExpenseSchema, updateFixedExpenseSchema } from './fixed-expenses.types';
import { AuthenticatedRequest } from '../auth/auth.types';

export async function handleListFixedExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    res.json(await listFixedExpenses(organizationId!));
  } catch (err) { next(err); }
}

export async function handleGetFixedExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const expense = await getFixedExpense(req.params.id as string, organizationId!);
    if (!expense) { res.status(404).json({ error: 'Fixed expense not found', code: 'NOT_FOUND' }); return; }
    res.json(expense);
  } catch (err) { next(err); }
}

export async function handleCreateFixedExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = createFixedExpenseSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    res.status(201).json(await createFixedExpense({ ...parsed.data, organizationId: organizationId! }));
  } catch (err) { next(err); }
}

export async function handleUpdateFixedExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = updateFixedExpenseSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    const result = await updateFixedExpense(req.params.id as string, organizationId!, parsed.data);
    if (!result) { res.status(404).json({ error: 'Fixed expense not found', code: 'NOT_FOUND' }); return; }
    res.json(result);
  } catch (err) { next(err); }
}

export async function handleDeleteFixedExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const ok = await softDeleteFixedExpense(req.params.id as string, organizationId!);
    if (!ok) { res.status(404).json({ error: 'Fixed expense not found', code: 'NOT_FOUND' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
}
