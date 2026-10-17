import type { Role } from '@prisma/client';
import type { Repositories, TransactionRunner } from '../repositories';
import type { EmailService } from './email.service';
import { notificationRecorder } from './notification.service';
import type { Actor, OrderService } from './order.service';

interface Deps {
  repos: Repositories;
  transaction: TransactionRunner;
  orders: OrderService;
  email: EmailService;
}

const otherRole = (role: Role): Role => (role === 'ADMIN' ? 'CUSTOMER' : 'ADMIN');

/** Customer ↔ administrator thread per order. Internal admin notes are a separate service. */
export function createMessageService({ repos, transaction, orders, email }: Deps) {
  return {
    async list(orderId: string, viewer: Actor) {
      const order = await orders.loadOrder(orderId, viewer);
      return repos.messages.listForOrder(order.id);
    },

    async send(orderId: string, viewer: Actor, body: string) {
      const order = await orders.loadOrder(orderId, viewer);
      const { message, recipients } = await transaction(async (tx) => {
        const message = await tx.messages.create({ orderId: order.id, senderId: viewer.id, senderRole: viewer.role, body });
        const recipients = await notificationRecorder.messageSent(tx, order, viewer.role);
        return { message, recipients };
      });
      void email.sendNewMessage(recipients, order);
      return message;
    },

    /** Called when the viewer opens the thread: marks the other party's messages as read. */
    async markRead(orderId: string, viewer: Actor) {
      const order = await orders.loadOrder(orderId, viewer);
      const now = new Date();
      await transaction(async (tx) => {
        await tx.messages.markReadFromSender(order.id, otherRole(viewer.role), now);
        await tx.notifications.markReadForOrder(viewer.id, order.id, 'ORDER_MESSAGE', now);
      });
    },
  };
}

export type MessageService = ReturnType<typeof createMessageService>;
