import { notFound } from '../domain/errors';
import type { StorageDriver } from '../infrastructure/storage';
import type { Repositories } from '../repositories';
import type { Actor } from './order.service';

function canRead(attachment: { orderId: string; order: { customerId: string | null } }, viewer: Actor): boolean {
  if (viewer.role === 'ADMIN') return true;
  if (viewer.id === null) return attachment.orderId === viewer.trackedOrderId && attachment.order.customerId === null;
  return attachment.order.customerId === viewer.id;
}

export function createAttachmentService({ repos, storage }: { repos: Repositories; storage: StorageDriver }) {
  return {
    /** Only the order's customer, the guest holding its tracking link, or an administrator may read a reference image. */
    async open(attachmentId: string, viewer: Actor) {
      const attachment = await repos.orders.findAttachmentWithOwner(attachmentId);
      if (!attachment || !canRead(attachment, viewer)) throw notFound('File not found');
      const file = await storage.getPrivate(attachment.storageKey);
      return { attachment, file };
    },
  };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
