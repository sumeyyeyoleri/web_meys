import { notFound } from '../domain/errors';
import type { StorageDriver } from '../infrastructure/storage';
import type { Repositories } from '../repositories';
import type { Actor } from './order.service';

export function createAttachmentService({ repos, storage }: { repos: Repositories; storage: StorageDriver }) {
  return {
    /** Only the order's customer or an administrator may read a reference image. */
    async open(attachmentId: string, viewer: Actor) {
      const attachment = await repos.orders.findAttachmentWithOwner(attachmentId);
      if (!attachment) throw notFound('File not found');
      if (viewer.role !== 'ADMIN' && attachment.order.customerId !== viewer.id) throw notFound('File not found');
      const file = await storage.getPrivate(attachment.storageKey);
      return { attachment, file };
    },
  };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
