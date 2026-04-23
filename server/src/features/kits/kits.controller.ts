import { Request, Response, NextFunction } from 'express';
import { listKits, getKit, createKit, updateKit, softDeleteKit } from './kits.service';
import { createKitSchema, updateKitSchema } from './kits.types';
import { AuthenticatedRequest } from '../auth/auth.types';

export async function handleListKits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    res.json(await listKits(organizationId!));
  } catch (err) { next(err); }
}

export async function handleGetKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const kit = await getKit(req.params.id as string, organizationId!);
    if (!kit) { res.status(404).json({ error: 'Kit not found', code: 'NOT_FOUND' }); return; }
    res.json(kit);
  } catch (err) { next(err); }
}

export async function handleCreateKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = createKitSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    const result = await createKit({ ...parsed.data, organizationId: organizationId! });
    if ('error' in result) {
      res.status(400).json({ error: 'One or more products not found or inactive', code: result.error });
      return;
    }
    res.status(201).json(result.kit);
  } catch (err) { next(err); }
}

export async function handleUpdateKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = updateKitSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    const result = await updateKit(req.params.id as string, organizationId!, parsed.data);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        res.status(404).json({ error: 'Kit not found', code: 'NOT_FOUND' });
      } else {
        res.status(400).json({ error: 'One or more products not found or inactive', code: 'INVALID_PRODUCT' });
      }
      return;
    }
    res.json(result.kit);
  } catch (err) { next(err); }
}
