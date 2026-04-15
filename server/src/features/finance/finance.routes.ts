import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleGetBalance,
  handleUpdateBalance,
  handleGetSummary,
  handlePayInstallment,
  handlePayExpenseLog,
  handleGetCashflow,
  handleGetOverdue,
} from './finance.controller';

export const financeRouter = Router();

financeRouter.use(authenticate, authorize('ADMIN', 'FINANCE'));

financeRouter.get('/balance', handleGetBalance);
financeRouter.put('/balance', handleUpdateBalance);
financeRouter.get('/summary', handleGetSummary);
financeRouter.get('/cashflow', handleGetCashflow);
financeRouter.get('/overdue', handleGetOverdue);
financeRouter.patch('/installments/:id/pay', handlePayInstallment);
financeRouter.patch('/expense-logs/:id/pay', handlePayExpenseLog);
