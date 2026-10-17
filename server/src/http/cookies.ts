import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/env';

export const SESSION_COOKIE = 'sid';
export const CSRF_COOKIE = 'csrf';

function baseOptions(config: Pick<AppConfig, 'isProduction'>): CookieOptions {
  return { sameSite: 'lax', secure: config.isProduction, path: '/' };
}

export function setSessionCookie(res: Response, config: AppConfig, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(config), httpOnly: true, expires: expiresAt });
}

export function clearSessionCookie(res: Response, config: AppConfig) {
  res.clearCookie(SESSION_COOKIE, { ...baseOptions(config), httpOnly: true });
}

/** Readable by the web app (double-submit), so deliberately not HttpOnly. */
export function setCsrfCookie(res: Response, config: AppConfig, token: string) {
  res.cookie(CSRF_COOKIE, token, { ...baseOptions(config), httpOnly: false });
}
