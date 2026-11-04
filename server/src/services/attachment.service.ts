import { notFound } from '../domain/errors';
import type { StorageDriver } from '../infrastructure/storage';
import type { Repositories } from '../repositories';
import type { Actor } from './order.service';

function canRead(attachment: { orderId: string }, viewer: Actor): boolean {
  return viewer.role === 'ADMIN' || attachment.orderId === viewer.trackedOrderId;
}

export function createAttachmentService({ repos, storage }: { repos: Repositories; storage: StorageDriver }) {
  return {
    /** Only the artist, or the customer holding the order's tracking link, may read a reference image. */
    async open(attachmentId: string, viewer: Actor) {
      const attachment = await repos.orders.findAttachment(attachmentId);
      if (!attachment || !canRead(attachment, viewer)) throw notFound('File not found');
      const file = await storage.getPrivate(attachment.storageKey);
      return { attachment, file };
    },
  };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
