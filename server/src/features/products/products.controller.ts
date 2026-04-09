import { Request, Response, NextFunction } from 'express';
import { listProducts, createProduct, updateProduct, softDeleteProduct } from './products.service';
import { createProductSchema, updateProductSchema } from './products.types';

export async function handleListProducts(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listProducts());
  } catch (err) {
    next(err);
  }
}

export async function handleCreateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    res.status(201).json(await createProduct(parsed.data));
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const product = await updateProduct(req.params.id as string, parsed.data);
    if (!product) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ok = await softDeleteProduct(req.params.id as string);
    if (!ok) {
      res.status(404).json({ error: 'Product not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
