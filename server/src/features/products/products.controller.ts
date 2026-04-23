import { Request, Response, NextFunction } from 'express';
import { listProducts, getProduct, createProduct, updateProduct, softDeleteProduct } from './products.service';
import { createProductSchema, updateProductSchema } from './products.types';
import { AuthenticatedRequest } from '../auth/auth.types';

export async function handleListProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    res.json(await listProducts(organizationId!));
  } catch (err) { next(err); }
}

export async function handleGetProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const product = await getProduct(req.params.id as string, organizationId!);
    if (!product) { res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' }); return; }
    res.json(product);
  } catch (err) { next(err); }
}

export async function handleCreateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    res.status(201).json(await createProduct({ ...parsed.data, organizationId: organizationId! }));
  } catch (err) { next(err); }
}

export async function handleUpdateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    const product = await updateProduct(req.params.id as string, organizationId!, parsed.data);
    if (!product) { res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' }); return; }
    res.json(product);
  } catch (err) { next(err); }
}

export async function handleDeleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const ok = await softDeleteProduct(req.params.id as string, organizationId!);
    if (!ok) { res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
}
