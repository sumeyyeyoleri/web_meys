import type { NotificationDto } from '@painter/shared';
import type { NotificationWithOrder } from '../../repositories/notification.repository';
import { toIso, toIsoOrNull } from './common';

export function toNotificationDto(notification: NotificationWithOrder): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    orderId: notification.orderId,
    orderReference: notification.order?.reference ?? null,
    status: notification.status,
    readAt: toIsoOrNull(notification.readAt),
    createdAt: toIso(notification.createdAt),
  };
}
