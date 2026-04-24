import { Request, Response, NextFunction } from 'express';
import { authenticate } from './authenticate';
import { signAccessToken } from '../features/auth/auth.service';
import { AuthenticatedRequest } from '../features/auth/auth.types';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const validPayload = { userId: 'user-1', role: 'ADMIN' as const, organizationId: null };

describe('authenticate middleware', () => {
  it('calls next() and injects req.user with valid Bearer token', () => {
    const token = signAccessToken(validPayload);
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.userId).toBe(validPayload.userId);
    expect(req.user.role).toBe(validPayload.role);
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });

  it('returns 401 when token is invalid', () => {
    const req = {
      headers: { authorization: 'Bearer not.a.valid.token' },
    } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
