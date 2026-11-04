import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminOrderDetailDto,
  AdminOrderSummaryDto,
  AdminOrderUpdateInput,
  AdminServiceDto,
  AdminStatsDto,
  AdminStatusChangeInput,
  ChangePasswordInput,
  InternalNoteDto,
  Locale,
  MessageDto,
  MessageTranslationDto,
  NotificationDto,
  Paginated,
  TrackingLinkDto,
  UnreadCountDto,
  UserDto,
} from '@painter/shared';
import { api } from '../../lib/api';
import { setLocale, useLocale } from '../../lib/i18n';
import { queryKeys } from '../../lib/query-keys';

/** Counters and threads refresh every ~30 s while the tab is visible (no websockets). */
const POLL_INTERVAL_MS = 30_000;

export interface OrderListFilter {
  page: number;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  includeArchived?: boolean;
}

export function useAdminStats() {
  const locale = useLocale();
  return useQuery({
    queryKey: [...queryKeys.admin.stats, locale],
    queryFn: ({ signal }) => api.get<AdminStatsDto>('/api/admin/stats', { locale }, signal),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useAdminOrders(filter: OrderListFilter) {
  const locale = useLocale();
  return useQuery({
    queryKey: queryKeys.admin.orders({ ...filter, locale }),
    queryFn: ({ signal }) =>
      api.get<Paginated<AdminOrderSummaryDto>>(
        '/api/admin/orders',
        { ...filter, includeArchived: filter.includeArchived ? 'true' : undefined, pageSize: 20, locale },
        signal,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useAdminOrder(id: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: [...queryKeys.admin.order(id), locale],
    queryFn: ({ signal }) => api.get<AdminOrderDetailDto>(`/api/admin/orders/${encodeURIComponent(id)}`, { locale }, signal),
  });
}

export function useAdminServices() {
  return useQuery({
    queryKey: queryKeys.admin.services,
    queryFn: ({ signal }) => api.get<AdminServiceDto[]>('/api/admin/services', undefined, signal),
  });
}

/** After a change to an order: refresh its detail, the lists and the counters. */
function useRefreshOrder() {
  const queryClient = useQueryClient();
  return (id: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.order(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.orderLists }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats }),
    ]);
}

export function useChangeStatus(id: string) {
  const refresh = useRefreshOrder();
  return useMutation({
    mutationFn: (input: AdminStatusChangeInput) => api.post<AdminOrderDetailDto>(`/api/admin/orders/${id}/status`, input),
    onSuccess: () => refresh(id),
  });
}

export function useUpdateOrder(id: string) {
  const refresh = useRefreshOrder();
  return useMutation({
    mutationFn: (input: AdminOrderUpdateInput) => api.put<AdminOrderDetailDto>(`/api/admin/orders/${id}`, input),
    onSuccess: () => refresh(id),
  });
}

export function useArchiveOrder(id: string) {
  const refresh = useRefreshOrder();
  return useMutation({
    mutationFn: () => api.post<AdminOrderDetailDto>(`/api/admin/orders/${id}/archive`),
    onSuccess: () => refresh(id),
  });
}

export function useNewTrackingLink(id: string) {
  return useMutation({ mutationFn: () => api.post<TrackingLinkDto>(`/api/admin/orders/${id}/tracking-link`) });
}

export function useAddNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<InternalNoteDto>(`/api/admin/orders/${id}/notes`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.order(id) }),
  });
}

export function useOrderMessages(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.messages(id),
    queryFn: ({ signal }) => api.get<MessageDto[]>(`/api/admin/orders/${id}/messages`, undefined, signal),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useSendMessage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<MessageDto>(`/api/admin/orders/${id}/messages`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.messages(id) }),
  });
}

/** "Translate" on a message, into the dashboard language (stored on the server, so asked once). */
export function translateOrderMessage(orderId: string) {
  return (messageId: string, targetLocale: Locale) =>
    api.post<MessageTranslationDto>(`/api/admin/orders/${orderId}/messages/${messageId}/translate`, { targetLocale });
}

/** Opening the thread marks the customer's messages as read. */
export function useMarkMessagesRead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/api/admin/orders/${id}/messages/read`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.orderLists }),
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
      ]),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: ChangePasswordInput) => api.post('/api/auth/change-password', input) });
}

/** Switches the dashboard language and remembers it for the artist (also used for their emails). */
export function useSetAdminLocale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (locale: Locale) => {
      await setLocale(locale);
      return api.patch<UserDto>('/api/admin/me', { preferredLocale: locale });
    },
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, { user }),
  });
}

/* ---------- Notifications (the artist's) ---------- */

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: ({ signal }) => api.get<UnreadCountDto>('/api/notifications/unread-count', undefined, signal),
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
