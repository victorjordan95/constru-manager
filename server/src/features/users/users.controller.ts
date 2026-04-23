import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { AuthenticatedRequest } from '../auth/auth.types';

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function handleListUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { organizationId } = (req as AuthenticatedRequest).user;
    const users = await prisma.user.findMany({
      where: { organizationId: organizationId ?? undefined },
      orderBy: { createdAt: 'desc' },
      select: USER_SELECT,
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function handleDeactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetId = req.params.id as string;
    const authReq = req as AuthenticatedRequest;

    if (targetId === authReq.user.userId) {
      res.status(400).json({ error: 'Cannot deactivate yourself', code: 'CANNOT_DEACTIVATE_SELF' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id: targetId } });
    if (!existing || existing.organizationId !== authReq.user.organizationId) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    if (!existing.isActive) {
      res.status(400).json({ error: 'User is already inactive', code: 'ALREADY_INACTIVE' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { isActive: false },
      select: USER_SELECT,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
