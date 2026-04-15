import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { handleListUsers, handleDeactivateUser } from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', authorize('ADMIN'), handleListUsers);
usersRouter.patch('/:id/deactivate', authorize('ADMIN'), handleDeactivateUser);
