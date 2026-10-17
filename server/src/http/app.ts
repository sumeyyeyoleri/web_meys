import './types';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Container } from '../container';
import { loadSession } from './middleware/auth';
import { corsForOrigin } from './middleware/cors';
import { csrfProtection } from './middleware/csrf';
import { apiNotFound, errorHandler } from './middleware/error-handler';
import { createRateLimiters, DEFAULT_RATE_LIMITS, type RateLimitConfig } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { createApiRouter } from './routes';

export interface AppOptions {
  rateLimits?: Partial<RateLimitConfig>;
}

export function createApp(container: Container, options: AppOptions = {}): Express {
  const { config, services, storage } = container;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      // Images are embedded by the web app, which may live on a sibling subdomain.
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.isProduction,
    }),
  );
  app.use(requestLogger);
  app.use(corsForOrigin(config.webOrigin));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // Public media (portfolio/service images) when stored on local disk.
  if (storage.localPublicDir) {
    app.use(
      '/media',
      express.static(storage.localPublicDir, { index: false, dotfiles: 'ignore', maxAge: '7d', fallthrough: false }),
    );
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const limiters = createRateLimiters({ ...DEFAULT_RATE_LIMITS, ...options.rateLimits });
  app.use('/api', loadSession(services.sessions, config));
  app.use('/api', csrfProtection(config));
  app.use('/api', createApiRouter(container, limiters));
  app.use('/api', apiNotFound);
  app.use(errorHandler);

  return app;
}
