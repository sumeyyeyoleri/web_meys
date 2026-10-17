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
        userId: order.customerId,
        email: { email: order.contactEmail, locale: localeFromDb(order.communicationLocale), isAdmin: false },
      },
    ];
  }
  const admins = await repos.users.findAdmins();
  return admins.map((admin) => ({
    userId: admin.id,
    email: { email: admin.email, locale: localeFromDb(admin.preferredLocale), isAdmin: true },
  }));
}

/**
 * In-app notifications. The `record*` functions run inside the caller's transaction and
 * return the email recipients so emails can be sent after the transaction commits.
 */
export const notificationRecorder = {
  async orderSubmitted(repos: Repositories, order: OrderRef): Promise<EmailRecipient[]> {
    const recipients = await recipientsFor(repos, order, 'CUSTOMER');
    await repos.notifications.createMany(
      recipients.map((r) => ({ userId: r.userId, type: 'ORDER_SUBMITTED', orderId: order.id })),
    );
    return recipients.map((r) => r.email);
  },

  async statusChanged(repos: Repositories, order: OrderRef, actorRole: Role, status: OrderStatus) {
    const recipients = await recipientsFor(repos, order, actorRole);
    await repos.notifications.createMany(
      recipients.map((r) => ({ userId: r.userId, type: 'ORDER_STATUS_CHANGED', orderId: order.id, status })),
    );
    return recipients.map((r) => r.email);
  },

  async messageSent(repos: Repositories, order: OrderRef, senderRole: Role) {
    const recipients = await recipientsFor(repos, order, senderRole);
    await repos.notifications.createMany(
      recipients.map((r) => ({ userId: r.userId, type: 'ORDER_MESSAGE', orderId: order.id })),
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
