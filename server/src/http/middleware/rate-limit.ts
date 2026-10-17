import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ApiErrorBody } from '@painter/shared';

export interface RateLimitRule {
  windowMs: number;
  limit: number;
}

export const RATE_LIMIT_NAMES = ['login', 'register', 'forgotPassword', 'resetPassword', 'orderSubmit', 'message'] as const;
export type RateLimitName = (typeof RATE_LIMIT_NAMES)[number];
export type RateLimitConfig = Record<RateLimitName, RateLimitRule>;

const MINUTE = 60 * 1000;

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  login: { windowMs: 15 * MINUTE, limit: 10 },
  register: { windowMs: 60 * MINUTE, limit: 10 },
  forgotPassword: { windowMs: 60 * MINUTE, limit: 5 },
  resetPassword: { windowMs: 60 * MINUTE, limit: 10 },
  orderSubmit: { windowMs: 60 * MINUTE, limit: 10 },
  message: { windowMs: 10 * MINUTE, limit: 30 },
};

export function createRateLimiters(config: RateLimitConfig): Record<RateLimitName, RequestHandler> {
  const body: ApiErrorBody = { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } };
  const make = (rule: RateLimitRule) =>
    rateLimit({
      windowMs: rule.windowMs,
      limit: rule.limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json(body);
      },
    });
  return {
    login: make(config.login),
    register: make(config.register),
    forgotPassword: make(config.forgotPassword),
    resetPassword: make(config.resetPassword),
    orderSubmit: make(config.orderSubmit),
    message: make(config.message),
  };
}
