import type { NotificationType, OrderStatus } from '@prisma/client';
import type { Db } from './db';

const notificationInclude = { order: { select: { reference: true } } } as const;

export function createNotificationRepository(db: Db) {
  return {
    createMany(
      data: Array<{ userId: string; type: NotificationType; orderId: string; status?: OrderStatus | null }>,
    ) {
      if (data.length === 0) return Promise.resolve({ count: 0 });
      return db.notification.createMany({ data });
    },

    async list(userId: string, skip: number, take: number) {
      const where = { userId };
      const [items, total] = await Promise.all([
        db.notification.findMany({ where, include: notificationInclude, orderBy: { createdAt: 'desc' }, skip, take }),
        db.notification.count({ where }),
      ]);
      return { items, total };
    },

    countUnread(userId: string) {
      return db.notification.count({ where: { userId, readAt: null } });
    },

    async markRead(id: string, userId: string, now: Date): Promise<boolean> {
      const result = await db.notification.updateMany({ where: { id, userId }, data: { readAt: now } });
      return result.count === 1;
    },

    markAllRead(userId: string, now: Date) {
      return db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
    },

    markReadForOrder(userId: string, orderId: string, type: NotificationType, now: Date) {
      return db.notification.updateMany({ where: { userId, orderId, type, readAt: null }, data: { readAt: now } });
    },
  };
}

export type NotificationRepository = ReturnType<typeof createNotificationRepository>;
export type NotificationWithOrder = Awaited<ReturnType<NotificationRepository['list']>>['items'][number];
