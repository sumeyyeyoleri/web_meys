import type { RequestHandler } from 'express';
import type { AppConfig } from '../../config/env';
import { unauthenticated } from '../../domain/errors';
import type { SessionService } from '../../services/session.service';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '../cookies';
import type { RequestAuth } from '../types';

/** Resolves the session cookie (if any) into `req.auth`; refreshes the sliding expiry. */
export function loadSession(sessions: SessionService, config: AppConfig): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 0 && token.length < 200) {
      const resolved = await sessions.resolve(token);
      if (resolved) {
        req.auth = { user: resolved.user, sessionToken: token };
        if (resolved.renewedExpiresAt) setSessionCookie(res, config, token, resolved.renewedExpiresAt);
      } else {
        clearSessionCookie(res, config);
      }
    }
    next();
  };
}

/** Every account is the artist's, so a valid session is all an admin route needs. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw unauthenticated();
  next();
};

/** For handlers behind `requireAdmin`. */
export function getAuth(req: Parameters<RequestHandler>[0]): RequestAuth {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}
