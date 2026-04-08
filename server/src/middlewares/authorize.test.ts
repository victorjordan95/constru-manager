import { Response, NextFunction } from 'express';
import { authorize } from './authorize';
import { AuthenticatedRequest } from '../features/auth/auth.types';

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('authorize middleware', () => {
  it('calls next() when user has the required role', () => {
    const req = {
      user: { userId: 'u1', role: 'ADMIN' },
    } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authorize('ADMIN')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when user role is in a multi-role list', () => {
    const req = {
      user: { userId: 'u1', role: 'SALES' },
    } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authorize('ADMIN', 'SALES')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when user does not have the required role', () => {
    const req = {
      user: { userId: 'u1', role: 'SALES' },
    } as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authorize('ADMIN')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('returns 401 when req.user is not set', () => {
    const req = {} as AuthenticatedRequest;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    authorize('ADMIN')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
