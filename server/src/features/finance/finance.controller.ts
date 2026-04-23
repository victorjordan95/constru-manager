import { Request, Response, NextFunction } from 'express';
import {
  getOpeningBalance,
  updateOpeningBalance,
  getFinanceSummary,
  payInstallment,
  payExpenseLog,
  getCashflow,
  getOverdueInstallments,
  getDRE,
} from './finance.service';
import { summaryQuerySchema, updateBalanceSchema, cashflowQuerySchema, dreQuerySchema } from './finance.types';
import { AuthenticatedRequest } from '../auth/auth.types';

export async function handleGetBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const openingBalance = await getOpeningBalance(organizationId!);
    res.json({ openingBalance });
  } catch (err) { next(err); }
}

export async function handleUpdateBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = updateBalanceSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    const openingBalance = await updateOpeningBalance(parsed.data.openingBalance, organizationId!);
    res.json({ openingBalance });
  } catch (err) { next(err); }
}

export async function handleGetSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' }); return; }
    const summary = await getFinanceSummary(parsed.data.month, parsed.data.year, organizationId!);
    res.json(summary);
  } catch (err) { next(err); }
}

export async function handleGetCashflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = cashflowQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' }); return; }
    const data = await getCashflow(parsed.data.months, organizationId!);
    res.json(data);
  } catch (err) { next(err); }
}

export async function handleGetOverdue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const data = await getOverdueInstallments(organizationId!);
    res.json(data);
  } catch (err) { next(err); }
}

export async function handlePayInstallment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const result = await payInstallment(req.params.id as string, organizationId!);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Installment not found', code: 'NOT_FOUND' });
      } else {
        res.status(400).json({ error: 'Installment already paid', code: 'ALREADY_PAID' });
      }
      return;
    }
    res.json(result.installment);
  } catch (err) { next(err); }
}

export async function handlePayExpenseLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const result = await payExpenseLog(req.params.id as string, organizationId!);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Expense log not found', code: 'NOT_FOUND' });
      } else {
        res.status(400).json({ error: 'Expense log already paid', code: 'ALREADY_PAID' });
      }
      return;
    }
    res.json(result.log);
  } catch (err) { next(err); }
}

export async function handleGetDRE(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = dreQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' }); return; }
    const data = await getDRE(parsed.data.month, parsed.data.year, organizationId!);
    res.json(data);
  } catch (err) { next(err); }
}
