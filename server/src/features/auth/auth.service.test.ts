import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  blacklistRefreshToken,
  isRefreshTokenBlacklisted,
} from './auth.service';

const payload = { userId: 'user-123', role: 'ADMIN' as const, organizationId: null };

describe('hashPassword / verifyPassword', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('MySecret123!');
    expect(hash).not.toBe('MySecret123!');
    await expect(verifyPassword('MySecret123!', hash)).resolves.toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('MySecret123!');
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});

describe('signAccessToken / verifyAccessToken', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
  });

  it('throws on invalid token', () => {
    expect(() => verifyAccessToken('not.a.token')).toThrow();
  });
});

describe('signRefreshToken / verifyRefreshToken', () => {
  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  it('throws on invalid token', () => {
    expect(() => verifyRefreshToken('bad.token')).toThrow();
  });
});

describe('blacklist', () => {
  it('returns false for a token not in the blacklist', () => {
    expect(isRefreshTokenBlacklisted('fresh-token')).toBe(false);
  });

  it('returns true after blacklisting a token', () => {
    const token = signRefreshToken(payload);
    blacklistRefreshToken(token);
    expect(isRefreshTokenBlacklisted(token)).toBe(true);
  });
});
