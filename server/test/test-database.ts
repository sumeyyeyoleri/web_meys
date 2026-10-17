import 'dotenv/config';

/**
 * Returns TEST_DATABASE_URL and refuses to continue unless it clearly points at a
 * test database — the tests truncate every table.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see server/.env.example).');
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${dbName}": the test database name must end with "_test".`);
  }
  return url;
}
