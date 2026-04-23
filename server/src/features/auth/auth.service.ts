import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { JwtPayload } from './auth.types';

const SALT_ROUNDS = 12;

// In-memory blacklist — cleared on server restart (acceptable for MVP)
const refreshTokenBlacklist = new Set<string>();

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function assertJwtPayload(decoded: unknown): asserts decoded is JwtPayload {
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as JwtPayload).userId !== 'string' ||
    typeof (decoded as JwtPayload).role !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }
  const p = decoded as Record<string, unknown>;
  if (p.organizationId === undefined) p.organizationId = null;
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  assertJwtPayload(decoded);
  return decoded;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  assertJwtPayload(decoded);
  return decoded;
}

export function blacklistRefreshToken(token: string): void {
  refreshTokenBlacklist.add(token);
}

export function isRefreshTokenBlacklisted(token: string): boolean {
  return refreshTokenBlacklist.has(token);
}
