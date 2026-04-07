import { envSchema } from './env.schema';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: 'test' as const,
};

describe('envSchema', () => {
  it('accepts a fully valid env object', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('rejects when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects JWT_ACCESS_SECRET shorter than 32 chars', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_ACCESS_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects JWT_REFRESH_SECRET shorter than 32 chars', () => {
    const result = envSchema.safeParse({ ...validEnv, JWT_REFRESH_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid NODE_ENV value', () => {
    const result = envSchema.safeParse({ ...validEnv, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid DATABASE_URL format', () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});
