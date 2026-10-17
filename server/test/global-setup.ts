import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-database';

/** Applies all migrations to the test database once before the test run. */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
