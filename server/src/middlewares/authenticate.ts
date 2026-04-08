import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../features/auth/auth.service';
import { AuthenticatedRequest } from '../features/auth/auth.types';

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
  }
}
