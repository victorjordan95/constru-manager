import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  role: Role;
}

// Extends Express Request so controllers can access req.user after authenticate middleware
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
