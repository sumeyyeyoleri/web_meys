import type { MessageDto } from '@painter/shared';
import type { MessageWithSender } from '../../repositories/message.repository';
import { toIso, toIsoOrNull } from './common';

/** Admin messages are shown under the business name; customer messages under the customer's name. */
export function toMessageDto(message: MessageWithSender, viewerId: string, businessName: string): MessageDto {
  return {
    id: message.id,
    senderRole: message.senderRole,
    senderName: message.senderRole === 'ADMIN' ? businessName : (message.sender.profile?.fullName ?? ''),
    body: message.body,
    readAt: toIsoOrNull(message.readAt),
    createdAt: toIso(message.createdAt),
    isOwn: message.senderId === viewerId,
  };
}
