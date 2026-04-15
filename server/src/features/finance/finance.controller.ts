import { Request, Response, NextFunction } from 'express';
import {
  getOpeningBalance,
  updateOpeningBalance,
  getFinanceSummary,
  payInstallment,
  payExpenseLog,
  getCashflow,
  getOverdueInstallments,
} from './finance.service';
import { summaryQuerySchema, updateBalanceSchema, cashflowQuerySchema } from './finance.types';

export async function handleGetBalance(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const openingBalance = await getOpeningBalance();
    res.json({ openingBalance });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateBalance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateBalanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const openingBalance = await updateOpeningBalance(parsed.data.openingBalance);
    res.json({ openingBalance });
  } catch (err) {
    next(err);
  }
}

export async function handleGetSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' });
      return;
    }
    const summary = await getFinanceSummary(parsed.data.month, parsed.data.year);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function handleGetCashflow(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = cashflowQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query params', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getCashflow(parsed.data.months);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleGetOverdue(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getOverdueInstallments();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function handlePayInstallment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await payInstallment(req.params.id as string);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Installment not found', code: 'NOT_FOUND' });
      } else {
        res.status(400).json({ error: 'Installment already paid', code: 'ALREADY_PAID' });
      }
      return;
    }
    res.json(result.installment);
  } catch (err) {
    next(err);
  }
}

export async function handlePayExpenseLog(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await payExpenseLog(req.params.id as string);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Expense log not found', code: 'NOT_FOUND' });
      } else {
        res.status(400).json({ error: 'Expense log already paid', code: 'ALREADY_PAID' });
      }
      return;
    }
    res.json(result.log);
  } catch (err) {
    next(err);
  }
}
