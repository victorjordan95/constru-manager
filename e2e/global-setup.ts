import { execSync, spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';

const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'server');

const testEnv = {
  ...process.env,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/constru_manager_test',
  PORT: '3001',
  JWT_SECRET: 'e2e-test-secret',
  JWT_REFRESH_SECRET: 'e2e-test-refresh-secret',
  NODE_ENV: 'test',
};

async function waitForPort(port: number, maxMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise<void>((resolve, reject) => {
      const sock = net.connect(port, '127.0.0.1', resolve);
      sock.on('error', reject);
      sock.unref();
    }).catch(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    // Check again
    const open = await new Promise<boolean>((resolve) => {
      const sock = net.connect(port, '127.0.0.1', () => { sock.destroy(); resolve(true); });
      sock.on('error', () => resolve(false));
      sock.unref();
    });
    if (open) return;
  }
  throw new Error(`Port ${port} not available after ${maxMs}ms`);
}

async function waitForServer(url: string, maxMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server at ${url} not ready after ${maxMs}ms`);
}

export default async function globalSetup() {
  // 1. Start Postgres container
  console.log('[e2e] Starting test Postgres...');
  execSync('docker compose -f e2e/docker-compose.test.yml up -d', {
    cwd: rootDir,
    stdio: 'inherit',
  });

  // 2. Wait for Postgres on port 5433
  await waitForPort(5433);
  console.log('[e2e] Postgres ready.');

  // 3. Run migrations against test DB
  console.log('[e2e] Running migrations...');
  execSync('npx prisma migrate deploy', {
    cwd: serverDir,
    env: testEnv,
    stdio: 'inherit',
  });

  // 4. Seed base users (ADMIN + SALES) via existing seed script
  console.log('[e2e] Seeding base users...');
  execSync('npx prisma db seed', {
    cwd: serverDir,
    env: testEnv,
    stdio: 'inherit',
  });

  // 5. Start Express server on port 3001
  console.log('[e2e] Starting test server...');
  const serverProcess: ChildProcess = spawn(
    'npx',
    ['ts-node', '-r', 'dotenv/config', 'src/server.ts'],
    {
      cwd: serverDir,
      env: testEnv,
      stdio: 'pipe',
      detached: false,
    },
  );

  fs.writeFileSync(path.join(__dirname, '.server-pid'), String(serverProcess.pid!));

  serverProcess.stderr?.on('data', (d: Buffer) => {
    if (process.env.E2E_DEBUG) process.stderr.write(d);
  });

  // 6. Wait for server to accept connections
  await waitForServer('http://localhost:3001/auth/login');
  console.log('[e2e] Test server ready on :3001');

  // 7. Create FINANCE user via API (seed only creates ADMIN + SALES)
  const loginRes = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@constru.dev', password: 'admin123' }),
  });
  const { accessToken } = await loginRes.json() as { accessToken: string };

  await fetch('http://localhost:3001/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      email: 'financeiro@constru.dev',
      password: 'finance123',
      role: 'FINANCE',
    }),
  });

  console.log('[e2e] Setup complete.');
}
