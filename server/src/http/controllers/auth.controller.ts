import type { Request, Response } from 'express';
import {
  adminProfileSchema,
  changeEmailSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  adminPreferencesSchema,
  loginSchema,
  resetPasswordSchema,
  type CsrfDto,
  localeToDb,
} from '@painter/shared';
import type { Container } from '../../container';
import { clearSessionCookie, setSessionCookie } from '../cookies';
import { toUserDto } from '../mappers/user.mapper';
import { getAuth } from '../middleware/auth';
import { ensureCsrfToken } from '../middleware/csrf';
import { parseBody } from '../middleware/validation';

export function createAuthController({ services, config }: Container) {
  const { auth, sessions } = services;

  /** Rotates the session: any previous session on this device is destroyed first. */
  async function startSession(req: Request, res: Response, userId: string) {
    if (req.auth) await sessions.destroy(req.auth.sessionToken);
    const { token, expiresAt } = await sessions.create(userId);
    setSessionCookie(res, config, token, expiresAt);
  }

  return {
    csrf(req: Request, res: Response) {
      const body: CsrfDto = { csrfToken: ensureCsrfToken(req, res, config) };
      res.json(body);
    },

    async login(req: Request, res: Response) {
      const user = await auth.login(parseBody(loginSchema, req));
      await startSession(req, res, user.id);
      res.json(toUserDto(user));
    },

    async logout(req: Request, res: Response) {
      if (req.auth) await sessions.destroy(req.auth.sessionToken);
      clearSessionCookie(res, config);
      res.status(204).end();
    },

    me(req: Request, res: Response) {
      res.json({ user: req.auth ? toUserDto(req.auth.user) : null });
    },

    async forgotPassword(req: Request, res: Response) {
      auth.forgotPassword(parseBody(forgotPasswordSchema, req).email);
      res.status(202).json({ ok: true });
    },

    async resetPassword(req: Request, res: Response) {
      await auth.resetPassword(parseBody(resetPasswordSchema, req));
      clearSessionCookie(res, config);
      res.status(204).end();
    },

    /** The artist's dashboard language (also used for the artist's emails). */
    async updatePreferences(req: Request, res: Response) {
      const { user } = getAuth(req);
      const { preferredLocale } = parseBody(adminPreferencesSchema, req);
      res.json(toUserDto(await services.users.updatePreferredLocale(user.id, localeToDb(preferredLocale))));
    },

    /** "My account": display name. */
    async updateProfile(req: Request, res: Response) {
      const { user } = getAuth(req);
      const { name } = parseBody(adminProfileSchema, req);
      res.json(toUserDto(await services.users.updateName(user.id, name ?? null)));
    },

    /** "My account": sign-in email; other devices are signed out, this one gets a fresh session. */
    async changeEmail(req: Request, res: Response) {
      const { user } = getAuth(req);
      const result = await auth.changeEmail(user.id, parseBody(changeEmailSchema, req));
      setSessionCookie(res, config, result.session.token, result.session.expiresAt);
      res.json(toUserDto(result.user));
    },

    async changePassword(req: Request, res: Response) {
      const { user } = getAuth(req);
      const { token, expiresAt } = await auth.changePassword(user.id, parseBody(changePasswordSchema, req));
      setSessionCookie(res, config, token, expiresAt);
      res.status(204).end();
    },
  };
}
