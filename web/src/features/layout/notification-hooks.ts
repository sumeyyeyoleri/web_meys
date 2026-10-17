import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto, Paginated, UnreadCountDto } from '@painter/shared';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

const POLL_INTERVAL_MS = 30_000;

/** Unread count, polled every ~30 s while the tab is visible (no websockets). */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: ({ signal }) => api.get<UnreadCountDto>('/api/notifications/unread-count', undefined, signal),
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    select: (data) => data.count,
  });
}

export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.list,
    queryFn: ({ signal }) => api.get<Paginated<NotificationDto>>('/api/notifications', { pageSize: 15 }, signal),
    enabled,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
