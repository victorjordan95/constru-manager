import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  createAdminForOrg,
} from './organizations.service';

const createOrgSchema = z.object({ name: z.string().min(1) });
const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function handleListOrgs(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await listOrganizations());
  } catch (err) {
    next(err);
  }
}

export async function handleCreateOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    res.status(201).json(await createOrganization(parsed.data.name));
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const org = await updateOrganization(req.params.id as string, parsed.data);
    if (!org) {
      res.status(404).json({ error: 'Organization not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(org);
  } catch (err) {
    next(err);
  }
}

export async function handleCreateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = await createAdminForOrg(
      req.params.orgId as string,
      parsed.data.email,
      parsed.data.password,
    );
    if ('error' in result) {
      const status = result.error === 'ORG_NOT_FOUND' ? 404 : 409;
      res.status(status).json({ error: result.error, code: result.error });
      return;
    }
    res.status(201).json(result.user);
  } catch (err) {
    next(err);
  }
}
