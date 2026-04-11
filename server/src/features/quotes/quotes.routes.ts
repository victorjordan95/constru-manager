import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate'
import { authorize } from '../../middlewares/authorize'
import {
  handleCreateQuote,
  handleListQuotes,
  handleGetQuote,
  handleAddVersion,
  handleUpdateStatus,
  handleAcceptQuote,
} from './quotes.controller'

export const quotesRouter = Router()

quotesRouter.use(authenticate)

// ADMIN + SALES
quotesRouter.get('/', authorize('ADMIN', 'SALES'), handleListQuotes)
quotesRouter.post('/', authorize('ADMIN', 'SALES'), handleCreateQuote)
quotesRouter.get('/:id', authorize('ADMIN', 'SALES'), handleGetQuote)
quotesRouter.post('/:id/versions', authorize('ADMIN', 'SALES'), handleAddVersion)

// ADMIN only
quotesRouter.patch('/:id/status', authorize('ADMIN'), handleUpdateStatus)
quotesRouter.post('/:id/accept', authorize('ADMIN'), handleAcceptQuote)
