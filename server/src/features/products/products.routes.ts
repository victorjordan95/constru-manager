import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import {
  handleListProducts,
  handleGetProduct,
  handleCreateProduct,
  handleUpdateProduct,
  handleDeleteProduct,
} from './products.controller';

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get('/', authorize('SALES', 'ADMIN'), handleListProducts);
productsRouter.post('/', authorize('ADMIN'), handleCreateProduct);
productsRouter.get('/:id', authorize('SALES', 'ADMIN'), handleGetProduct);
productsRouter.put('/:id', authorize('ADMIN'), handleUpdateProduct);
productsRouter.delete('/:id', authorize('ADMIN'), handleDeleteProduct);
