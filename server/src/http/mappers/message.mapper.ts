import type { MessageDto } from '@painter/shared';
import type { MessageWithSender } from '../../repositories/message.repository';
import { toIso, toIsoOrNull } from './common';

export interface MessageNames {
  businessName: string;
  /** The order's contact name: used for guests, who have no profile. */
  contactName: string;
}

/**
 * Admin messages are shown under the business name; customer messages under the customer's name.
 * A guest viewer (`viewerId` null) owns every customer message of the order they track.
 */
export function toMessageDto(message: MessageWithSender, viewerId: string | null, names: MessageNames): MessageDto {
  return {
    id: message.id,
    senderRole: message.senderRole,
    senderName: message.senderRole === 'ADMIN' ? names.businessName : (message.sender?.profile?.fullName ?? names.contactName),
    body: message.body,
    readAt: toIsoOrNull(message.readAt),
    createdAt: toIso(message.createdAt),
    isOwn: viewerId === null ? message.senderRole === 'CUSTOMER' : message.senderId === viewerId,
  };
}
