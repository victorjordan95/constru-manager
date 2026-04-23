import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import {
  listClients,
  getClientById,
  createClient,
  updateClient,
  softDeleteClient,
} from './clients.service';
import { createClientSchema, updateClientSchema } from './clients.types';
import { AuthenticatedRequest } from '../auth/auth.types';

export async function handleListClients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    res.json(await listClients(organizationId!));
  } catch (err) { next(err); }
}

export async function handleGetClientById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const client = await getClientById(req.params.id as string, organizationId!);
    if (!client) { res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' }); return; }
    res.json(client);
  } catch (err) { next(err); }
}

export async function handleCreateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    res.status(201).json(await createClient({ ...parsed.data, organizationId: organizationId! }));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Tax ID already in use', code: 'DUPLICATE_TAX_ID' });
      return;
    }
    next(err);
  }
}

export async function handleUpdateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }); return; }
    const client = await updateClient(req.params.id as string, organizationId!, parsed.data);
    if (!client) { res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' }); return; }
    res.json(client);
  } catch (err) { next(err); }
}

export async function handleDeleteClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const ok = await softDeleteClient(req.params.id as string, organizationId!);
    if (!ok) { res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
}
