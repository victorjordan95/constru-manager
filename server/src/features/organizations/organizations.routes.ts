import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleListOrgs,
  handleCreateOrg,
  handleUpdateOrg,
  handleCreateAdmin,
  handleGetCurrentOrg,
  handleUploadLogo,
  upload,
} from './organizations.controller';

export const organizationsRouter = Router();

// Routes accessible without SUPER_ADMIN (must come before the use() call below)
organizationsRouter.get('/current', authenticate, handleGetCurrentOrg);
organizationsRouter.post(
  '/:id/logo',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  upload.single('logo'),
  handleUploadLogo,
);

// SUPER_ADMIN-only routes
organizationsRouter.use(authenticate, authorize('SUPER_ADMIN'));
organizationsRouter.get('/', handleListOrgs);
organizationsRouter.post('/', handleCreateOrg);
organizationsRouter.patch('/:id', handleUpdateOrg);
organizationsRouter.post('/:orgId/admin', handleCreateAdmin);
