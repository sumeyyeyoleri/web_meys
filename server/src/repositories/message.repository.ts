import type { Role } from '@prisma/client';
import type { Db } from './db';

const messageInclude = { sender: { select: { profile: { select: { fullName: true } } } } } as const;

export function createMessageRepository(db: Db) {
  return {
    listForOrder(orderId: string) {
      return db.orderMessage.findMany({ where: { orderId }, include: messageInclude, orderBy: { createdAt: 'asc' } });
    },

    create(data: { orderId: string; senderId: string; senderRole: Role; body: string }) {
      return db.orderMessage.create({ data, include: messageInclude });
    },

    /** Marks every unread message written by `senderRole` in this thread as read. */
    markReadFromSender(orderId: string, senderRole: Role, now: Date) {
      return db.orderMessage.updateMany({ where: { orderId, senderRole, readAt: null }, data: { readAt: now } });
    },
  };
}

export type MessageRepository = ReturnType<typeof createMessageRepository>;
export type MessageWithSender = Awaited<ReturnType<MessageRepository['create']>>;
