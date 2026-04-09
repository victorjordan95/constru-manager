import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleListClients,
  handleGetClientById,
  handleCreateClient,
  handleUpdateClient,
  handleDeleteClient,
} from './clients.controller';

export const clientsRouter = Router();

clientsRouter.use(authenticate);

clientsRouter.get('/', authorize('SALES', 'ADMIN'), handleListClients);
clientsRouter.post('/', authorize('SALES', 'ADMIN'), handleCreateClient);
clientsRouter.get('/:id', authorize('SALES', 'ADMIN'), handleGetClientById);
clientsRouter.put('/:id', authorize('SALES', 'ADMIN'), handleUpdateClient);
clientsRouter.delete('/:id', authorize('ADMIN'), handleDeleteClient);
