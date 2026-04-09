import { Request, Response, NextFunction } from 'express';
import { listKits, createKit, updateKit } from './kits.service';
import { createKitSchema, updateKitSchema } from './kits.types';

export async function handleListKits(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await listKits());
  } catch (err) {
    next(err);
  }
}

export async function handleCreateKit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createKitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = await createKit(parsed.data);
    if ('error' in result) {
      res.status(400).json({ error: 'One or more products not found or inactive', code: result.error });
      return;
    }
    res.status(201).json(result.kit);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateKit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateKitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = await updateKit(req.params.id as string, parsed.data);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Kit not found', code: 'NOT_FOUND' });
      } else {
        res.status(400).json({ error: 'One or more products not found or inactive', code: 'INVALID_PRODUCT' });
      }
      return;
    }
    res.json(result.kit);
  } catch (err) {
    next(err);
  }
}
