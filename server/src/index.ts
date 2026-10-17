import { loadConfig } from './config/env';
import { createContainer } from './container';
import { createApp } from './http/app';
import { describeError, logger } from './infrastructure/logger';

const SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function main() {
  const config = loadConfig();
  const container = createContainer(config);
  await container.prisma.$connect();

  const app = createApp(container);
  const server = app.listen(config.port, () => {
    logger.info('API listening', { port: config.port, env: config.env, storage: config.storage.driver, smtp: !!config.smtp });
  });

  const cleanup = setInterval(() => {
    container.services.sessions
      .deleteExpired()
      .catch((error: unknown) => logger.error('Session cleanup failed', describeError(error)));
  }, SESSION_CLEANUP_INTERVAL_MS);
  cleanup.unref();

  const shutdown = (signal: string) => {
    logger.info('Shutting down', { signal });
    server.close(() => {
      void container.prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
