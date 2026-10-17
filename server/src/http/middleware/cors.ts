import type { RequestHandler } from 'express';

/** CORS restricted to the configured web origin, with credentials (cookies). */
export function corsForOrigin(allowedOrigin: string): RequestHandler {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    }
    res.append('Vary', 'Origin');
    if (req.method === 'OPTIONS' && req.get('access-control-request-method')) {
      if (origin === allowedOrigin) {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
        res.setHeader('Access-Control-Max-Age', '600');
      }
      res.status(204).end();
      return;
    }
    next();
  };
}
