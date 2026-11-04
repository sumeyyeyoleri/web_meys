import type { Order, OrderStatus, Role } from '@prisma/client';
import { localeFromDb } from '@painter/shared';
import { notFound } from '../domain/errors';
import type { Repositories } from '../repositories';
import type { EmailRecipient } from './email.service';

type OrderRef = Pick<Order, 'id' | 'customerId' | 'contactEmail' | 'communicationLocale'>;

/** Recipients on the "other side" of an order event. */
async function recipientsFor(repos: Repositories, order: OrderRef, actorRole: Role) {
  if (actorRole === 'ADMIN') {
    return [
      {
        // Guests have no account, so no in-app notification — only the email.
        userId: order.customerId,
        email: {
          email: order.contactEmail,
          locale: localeFromDb(order.communicationLocale),
          audience: order.customerId ? ('customer' as const) : ('guest' as const),
        },
      },
    ];
  }
  const admins = await repos.users.findAdmins();
  return admins.map((admin) => ({
    userId: admin.id,
    email: { email: admin.email, locale: localeFromDb(admin.preferredLocale), audience: 'admin' as const },
  }));
}

/** In-app notification rows for the recipients that have an account. */
function rowsFor<T>(recipients: Array<{ userId: string | null }>, row: (userId: string) => T): T[] {
  return recipients.flatMap((r) => (r.userId ? [row(r.userId)] : []));
}

/**
 * In-app notifications. The `record*` functions run inside the caller's transaction and
 * return the email recipients so emails can be sent after the transaction commits.
 */
export const notificationRecorder = {
  async orderSubmitted(repos: Repositories, order: OrderRef): Promise<EmailRecipient[]> {
    const recipients = await recipientsFor(repos, order, 'CUSTOMER');
    await repos.notifications.createMany(
      rowsFor(recipients, (userId) => ({ userId, type: 'ORDER_SUBMITTED' as const, orderId: order.id })),
    );
    return recipients.map((r) => r.email);
  },

  async statusChanged(repos: Repositories, order: OrderRef, actorRole: Role, status: OrderStatus) {
    const recipients = await recipientsFor(repos, order, actorRole);
    await repos.notifications.createMany(
      rowsFor(recipients, (userId) => ({ userId, type: 'ORDER_STATUS_CHANGED' as const, orderId: order.id, status })),
    );
    return recipients.map((r) => r.email);
  },

  async messageSent(repos: Repositories, order: OrderRef, senderRole: Role) {
    const recipients = await recipientsFor(repos, order, senderRole);
    await repos.notifications.createMany(
      rowsFor(recipients, (userId) => ({ userId, type: 'ORDER_MESSAGE' as const, orderId: order.id })),
    );
    return recipients.map((r) => r.email);
  },
};

export function createNotificationService({ repos }: { repos: Repositories }) {
  return {
    list(userId: string, page: number, pageSize: number) {
      return repos.notifications.list(userId, (page - 1) * pageSize, pageSize);
    },

    unreadCount(userId: string) {
      return repos.notifications.countUnread(userId);
    },

    async markRead(userId: string, notificationId: string) {
      const updated = await repos.notifications.markRead(notificationId, userId, new Date());
      if (!updated) throw notFound('Notification not found');
    },

    async markAllRead(userId: string) {
      await repos.notifications.markAllRead(userId, new Date());
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
