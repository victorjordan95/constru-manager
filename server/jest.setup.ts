import { config } from 'dotenv';

// Load real .env so integration tests can reach the database
config({ path: '.env' });

// Fallback values for vars not in .env (used in CI or pure unit test runs)
process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-min-32-chars-padding';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-min-32-chars-pad';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.NODE_ENV ??= 'test';
