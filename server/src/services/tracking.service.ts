import { localeFromDb, TRACKING_TOKEN_TTL_DAYS } from '@painter/shared';
import type { Order } from '@prisma/client';
import type { AppConfig } from '../config/env';
import { AppError, notFound } from '../domain/errors';
import { generateToken, sha256 } from '../infrastructure/crypto';
import type { Repositories, TransactionRunner } from '../repositories';
import type { EmailService } from './email.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 32 random bytes in base64url are always 43 characters. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface IssuedTrackingLink {
  url: string;
  expiresAt: Date;
}

export interface TrackingLinkResult extends IssuedTrackingLink {
  emailSent: boolean;
}

interface Deps {
  repos: Repositories;
  transaction: TransactionRunner;
  email: EmailService;
  config: Pick<AppConfig, 'webOrigin'>;
}

/**
 * Private tracking links for guest orders (`/track#<token>`). Only sha256(token) is stored;
 * the order reference alone never grants access.
 */
export function createTrackingService({ repos, transaction, email, config }: Deps) {
  /** Creates a new token for the order (inside the caller's transaction) and returns the link. */
  async function issue(txRepos: Repositories, orderId: string): Promise<IssuedTrackingLink> {
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + TRACKING_TOKEN_TTL_DAYS * DAY_MS);
    await txRepos.trackingTokens.create({ orderId, tokenHash: sha256(token), expiresAt });
    // The token sits in the fragment: it never reaches server logs or the Referer header.
    return { url: `${config.webOrigin}/track#${token}`, expiresAt };
  }

  /** Emails the link to the order's contact address when SMTP is configured. */
  function sendLink(order: Pick<Order, 'contactEmail' | 'communicationLocale' | 'reference'>, url: string) {
    return email.sendTrackingLink(
      { email: order.contactEmail, locale: localeFromDb(order.communicationLocale) },
      order.reference,
      url,
    );
  }

  return {
    issue,
    sendLink,

    /** The order a token gives access to; null for malformed, unknown, expired or revoked tokens. */
    async resolve(token: string | undefined): Promise<string | null> {
      if (!token || !TOKEN_PATTERN.test(token)) return null;
      const found = await repos.trackingTokens.findActive(sha256(token), new Date());
      return found?.orderId ?? null;
    },

    /** Admin: revokes every earlier link of a guest order and issues a new one (shown once). */
    async regenerate(orderId: string): Promise<TrackingLinkResult> {
      const order = await repos.orders.findById(orderId);
      if (!order) throw notFound('Order not found');
      if (order.customerId) {
        throw new AppError(409, 'CONFLICT', 'Only guest orders have a tracking link; customers use their account');
      }
      const link = await transaction(async (tx) => {
        await tx.trackingTokens.revokeAllForOrder(order.id, new Date());
        return issue(tx, order.id);
      });
      return { ...link, emailSent: await sendLink(order, link.url) };
    },
  };
}

export type TrackingService = ReturnType<typeof createTrackingService>;
