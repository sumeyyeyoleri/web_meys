import type { OrderStatus } from '@painter/shared';
import type { Locale } from '@painter/shared';
import type { AppConfig } from '../config/env';
import { logger } from '../infrastructure/logger';
import type { Mailer } from '../infrastructure/mailer';
import type { Repositories } from '../repositories';
import { emailCopy, wrapEmail } from './email-templates';

export interface EmailRecipient {
  email: string;
  locale: Locale;
  /** The artist gets a link to the dashboard; customers a hint to open their saved tracking link. */
  audience: 'admin' | 'customer';
}

interface Deps {
  mailer: Mailer;
  repos: Repositories;
  config: Pick<AppConfig, 'webOrigin' | 'env'>;
}

/**
 * Sends transactional emails in the recipient's language. Order emails respect the
 * admin's "email notifications" switch. Nothing is reported as sent unless SMTP accepted it.
 */
export function createEmailService({ mailer, repos, config }: Deps) {
  async function businessName(): Promise<string> {
    return (await repos.content.getSettings())?.businessName ?? '';
  }

  async function orderEmailsEnabled(): Promise<boolean> {
    if (!mailer.configured) return false;
    return (await repos.content.getSettings())?.emailNotificationsEnabled ?? false;
  }

  const adminLink = (orderId: string) => `${config.webOrigin}/admin/orders/${orderId}`;

  return {
    get isConfigured() {
      return mailer.configured;
    },

    /** Returns true only if the email was actually accepted by the SMTP server. */
    async sendPasswordReset(recipient: { email: string; locale: Locale }, token: string): Promise<boolean> {
      const link = `${config.webOrigin}/admin/reset-password?token=${encodeURIComponent(token)}`;
      if (!mailer.configured) {
        if (config.env === 'development') {
          // Development aid only: SMTP is not configured, so the link is printed instead of emailed.
          console.log(`\n[dev] Password reset link (SMTP not configured): ${link}\n`);
        } else {
          logger.warn('Password reset requested but SMTP is not configured');
        }
        return false;
      }
      const copy = emailCopy(recipient.locale);
      return mailer.send({
        to: recipient.email,
        subject: copy.passwordReset.subject,
        text: wrapEmail(recipient.locale, await businessName(), copy.passwordReset.body(link)),
      });
    },

    /**
     * The private tracking link of an order. Sent whenever SMTP is configured — like the
     * password reset it is part of the order itself, not an optional notification.
     * Returns true only if the email was actually accepted by the SMTP server.
     */
    async sendTrackingLink(recipient: { email: string; locale: Locale }, reference: string, link: string): Promise<boolean> {
      if (!mailer.configured) return false;
      const copy = emailCopy(recipient.locale);
      return mailer.send({
        to: recipient.email,
        subject: copy.customer.trackingLink.subject(reference),
        text: wrapEmail(recipient.locale, await businessName(), copy.customer.trackingLink.body(reference, link)),
      });
    },

    async sendStatusChanged(recipients: EmailRecipient[], order: { id: string; reference: string }, status: OrderStatus) {
      if (!(await orderEmailsEnabled())) return;
      const name = await businessName();
      await Promise.all(
        recipients.map((recipient) => {
          const copy = emailCopy(recipient.locale);
          return mailer.send({
            to: recipient.email,
            subject: copy.statusChanged.subject(order.reference),
            text: wrapEmail(
              recipient.locale,
              name,
              recipient.audience === 'customer'
                ? copy.customer.statusChanged(order.reference, copy.statusLabels[status])
                : copy.statusChanged.body(order.reference, copy.statusLabels[status], adminLink(order.id)),
            ),
          });
        }),
      );
    },

    async sendNewMessage(recipients: EmailRecipient[], order: { id: string; reference: string }) {
      if (!(await orderEmailsEnabled())) return;
      const name = await businessName();
      await Promise.all(
        recipients.map((recipient) => {
          const copy = emailCopy(recipient.locale);
          return mailer.send({
            to: recipient.email,
            subject: copy.newMessage.subject(order.reference),
            text: wrapEmail(
              recipient.locale,
              name,
              recipient.audience === 'customer'
                ? copy.customer.newMessage(order.reference)
                : copy.newMessage.body(order.reference, adminLink(order.id)),
            ),
          });
        }),
      );
    },

    async sendOrderSubmitted(recipients: EmailRecipient[], order: { id: string; reference: string }) {
      if (!(await orderEmailsEnabled())) return;
      const name = await businessName();
      await Promise.all(
        recipients.map((recipient) => {
          const copy = emailCopy(recipient.locale);
          return mailer.send({
            to: recipient.email,
            subject: copy.orderSubmitted.subject(order.reference),
            text: wrapEmail(
              recipient.locale,
              name,
              copy.orderSubmitted.body(order.reference, adminLink(order.id)),
            ),
          });
        }),
      );
    },
  };
}

export type EmailService = ReturnType<typeof createEmailService>;
