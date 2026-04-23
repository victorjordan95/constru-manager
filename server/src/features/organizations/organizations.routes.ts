import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleListOrgs,
  handleCreateOrg,
  handleUpdateOrg,
  handleCreateAdmin,
} from './organizations.controller';

export const organizationsRouter = Router();

organizationsRouter.use(authenticate, authorize('SUPER_ADMIN'));

organizationsRouter.get('/', handleListOrgs);
organizationsRouter.post('/', handleCreateOrg);
organizationsRouter.patch('/:id', handleUpdateOrg);
organizationsRouter.post('/:orgId/admin', handleCreateAdmin);
