import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const rootDir = path.resolve(__dirname, '..');

export default async function globalTeardown() {
  // Kill Express server
  const pidFile = path.join(__dirname, '.server-pid');
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(pid);
    } catch {
      // process may have already exited
    }
    fs.unlinkSync(pidFile);
  }

  // Stop Docker container
  try {
    execSync('docker compose -f e2e/docker-compose.test.yml down', {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch {
    // non-fatal if already stopped
  }

  console.log('[e2e] Teardown complete.');
}
