import type { Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../../config/env';
import { AppError } from '../../domain/errors';
import { generateToken, hmacSha256, safeEqual } from '../../infrastructure/crypto';
import { CSRF_COOKIE, setCsrfCookie } from '../cookies';

export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Token = random value + HMAC(secret, random value), so only the server can mint valid tokens. */
function isWellFormed(token: string, secret: string): boolean {
  const [value, signature] = token.split('.');
  if (!value || !signature) return false;
  return safeEqual(signature, hmacSha256(secret, value));
}

/** Returns the current valid CSRF token or issues a new one (sets the cookie). */
export function ensureCsrfToken(req: Request, res: Response, config: AppConfig): string {
  const existing: unknown = req.cookies?.[CSRF_COOKIE];
  if (typeof existing === 'string' && existing.length < 200 && isWellFormed(existing, config.sessionSecret)) {
    return existing;
  }
  const value = generateToken(32);
  const token = `${value}.${hmacSha256(config.sessionSecret, value)}`;
  setCsrfCookie(res, config, token);
  return token;
}

/**
 * Double-submit CSRF protection for every state-changing request: the `csrf` cookie must
 * equal the `X-CSRF-Token` header (constant-time) and the Origin, when sent, must be allowed.
 */
export function csrfProtection(config: AppConfig): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.get('origin');
    if (origin && origin !== config.webOrigin) {
      throw new AppError(403, 'CSRF_INVALID', 'Origin not allowed');
    }
    const cookie: unknown = req.cookies?.[CSRF_COOKIE];
    const header = req.get(CSRF_HEADER);
    if (
      typeof cookie !== 'string' ||
      !header ||
      !isWellFormed(cookie, config.sessionSecret) ||
      !safeEqual(cookie, header)
    ) {
      throw new AppError(403, 'CSRF_INVALID', 'Missing or invalid CSRF token');
    }
    next();
  };
}
