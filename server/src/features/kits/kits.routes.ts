import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleListKits,
  handleGetKit,
  handleCreateKit,
  handleUpdateKit,
} from './kits.controller';

export const kitsRouter = Router();

// All kit routes are ADMIN-only
kitsRouter.use(authenticate, authorize('ADMIN'));

kitsRouter.get('/', handleListKits);
kitsRouter.get('/:id', handleGetKit);
kitsRouter.post('/', handleCreateKit);
kitsRouter.put('/:id', handleUpdateKit);
