import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { testDatabaseUrl } from './test-database';

// Runs before each test file: point the app at the test database and throwaway storage.
const storageRoot = mkdtempSync(path.join(tmpdir(), 'painter-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl(),
  WEB_ORIGIN: 'http://localhost:5173',
  SESSION_SECRET: 'test-session-secret-that-is-long-enough-1234567890',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_PUBLIC_DIR: path.join(storageRoot, 'public'),
  STORAGE_LOCAL_PRIVATE_DIR: path.join(storageRoot, 'private'),
  SMTP_HOST: '',
});
