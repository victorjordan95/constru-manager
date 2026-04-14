import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate'
import { authorize } from '../../middlewares/authorize'
import {
  handleListFixedExpenses,
  handleCreateFixedExpense,
  handleUpdateFixedExpense,
  handleDeleteFixedExpense,
} from './fixed-expenses.controller'

export const fixedExpensesRouter = Router()

fixedExpensesRouter.use(authenticate, authorize('ADMIN', 'FINANCE'))

fixedExpensesRouter.get('/', handleListFixedExpenses)
fixedExpensesRouter.post('/', handleCreateFixedExpense)
fixedExpensesRouter.put('/:id', handleUpdateFixedExpense)
fixedExpensesRouter.delete('/:id', handleDeleteFixedExpense)
