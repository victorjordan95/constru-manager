import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  role: Role;
  organizationId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
