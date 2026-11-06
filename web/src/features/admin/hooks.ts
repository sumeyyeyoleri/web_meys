import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminCategoryDto, AdminContentDto, AdminOrderDetailDto, AdminOrderSummaryDto, AdminOrderUpdateInput, AdminPortfolioItemDto, AdminProfileInput, AdminServiceDto, AdminSettingsDto, AdminStatsDto, AdminStatusChangeInput, CategoryInput, ChangeEmailInput, ChangePasswordInput, ContentUpdateInput, InternalNoteDto, Locale, MediaUploadDto, MessageDto, MessageTranslationDto, NotificationDto, Paginated, PortfolioItemInput, ServiceInput, SiteSettingsInput, TrackingLinkDto, UnreadCountDto, UserDto } from '@painter/shared';
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

/** "My account": display name. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminProfileInput) => api.put<UserDto>('/api/admin/account/profile', input),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, { user }),
  });
}

/** "My account": sign-in email (other devices are signed out). */
export function useChangeEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeEmailInput) => api.post<UserDto>('/api/admin/account/email', input),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, { user }),
  });
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

/* ---------- Site settings (phase 9b) ---------- */

/** The public site reads settings and texts through `/api/site`: refresh it after a change. */
const refreshSite = (queryClient: ReturnType<typeof useQueryClient>) => queryClient.invalidateQueries({ queryKey: ['site'] });

export function useAdminSettings() {
  return useQuery({
    queryKey: queryKeys.admin.settings,
    queryFn: ({ signal }) => api.get<AdminSettingsDto>('/api/admin/settings', undefined, signal),
  });
}

function useSettingsMutation<T>(mutationFn: (input: T) => Promise<AdminSettingsDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.admin.settings, settings);
      void refreshSite(queryClient);
    },
  });
}

export function useUpdateSettings() {
  return useSettingsMutation((input: SiteSettingsInput) => api.put<AdminSettingsDto>('/api/admin/settings', input));
}

export function useUploadLogo() {
  return useSettingsMutation((file: File) => {
    const body = new FormData();
    body.append('file', file);
    return api.post<AdminSettingsDto>('/api/admin/settings/logo', body);
  });
}

export function useRemoveLogo() {
  return useSettingsMutation(() => api.delete<AdminSettingsDto>('/api/admin/settings/logo'));
}

/** Uploads one public image (catalog, services, welcome screen) and returns its URL. */
export function useUploadMedia() {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api.post<MediaUploadDto>('/api/admin/media', body);
    },
  });
}

/* ---------- Services (phase 9b) ---------- */

/** After a service change: the dashboard list, the public services and the order form. */
function useRefreshServices() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.services });
    void queryClient.invalidateQueries({ queryKey: ['services'] });
  };
}

export function useSaveService(id: string | null) {
  const refresh = useRefreshServices();
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      id ? api.put<AdminServiceDto>(`/api/admin/services/${id}`, input) : api.post<AdminServiceDto>('/api/admin/services', input),
    onSuccess: refresh,
  });
}

export function useServiceActions() {
  const refresh = useRefreshServices();
  return {
    move: useMutation({
      mutationFn: (input: { id: string; direction: 'up' | 'down' }) => api.post<AdminServiceDto[]>('/api/admin/services/reorder', input),
      onSuccess: refresh,
    }),
    setActive: useMutation({
      mutationFn: ({ id, value }: { id: string; value: boolean }) => api.post<AdminServiceDto>(`/api/admin/services/${id}/active`, { value }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/api/admin/services/${id}`), onSuccess: refresh }),
  };
}

/* ---------- Catalog: categories and works (phase 9b) ---------- */

/** After a catalog change: the dashboard lists and everything the public catalog shows. */
function useRefreshCatalog() {
  const queryClient = useQueryClient();
  return () => {
    for (const queryKey of [queryKeys.admin.portfolio, queryKeys.admin.categories, ['portfolio'], ['portfolio-item'], ['categories']]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
}

export function useAdminCategories() {
  return useQuery({
    queryKey: queryKeys.admin.categories,
    queryFn: ({ signal }) => api.get<AdminCategoryDto[]>('/api/admin/categories', undefined, signal),
  });
}

export function useSaveCategory(id: string | null) {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (input: CategoryInput) =>
      id ? api.put<AdminCategoryDto>(`/api/admin/categories/${id}`, input) : api.post<AdminCategoryDto>('/api/admin/categories', input),
    onSuccess: refresh,
  });
}

export function useCategoryActions() {
  const refresh = useRefreshCatalog();
  return {
    move: useMutation({
      mutationFn: (input: { id: string; direction: 'up' | 'down' }) => api.post<AdminCategoryDto[]>('/api/admin/categories/reorder', input),
      onSuccess: refresh,
    }),
    setVisible: useMutation({
      mutationFn: ({ id, value }: { id: string; value: boolean }) => api.post<AdminCategoryDto>(`/api/admin/categories/${id}/visible`, { value }),
      onSuccess: refresh,
    }),
    /** Its works move to `moveTo`, or become uncategorised. */
    remove: useMutation({
      mutationFn: ({ id, moveTo }: { id: string; moveTo?: string }) =>
        api.delete(`/api/admin/categories/${id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`),
      onSuccess: refresh,
    }),
  };
}

export function useAdminPortfolio() {
  return useQuery({
    queryKey: queryKeys.admin.portfolio,
    queryFn: ({ signal }) => api.get<AdminPortfolioItemDto[]>('/api/admin/portfolio', undefined, signal),
  });
}

export function useSavePortfolioItem(id: string | null) {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (input: PortfolioItemInput) =>
      id ? api.put<AdminPortfolioItemDto>(`/api/admin/portfolio/${id}`, input) : api.post<AdminPortfolioItemDto>('/api/admin/portfolio', input),
    onSuccess: refresh,
  });
}

/** Several photos at once: each becomes a draft work (title from the file name) in one category. */
export function useBulkUpload() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: async ({ files, categoryId, onProgress }: { files: File[]; categoryId: string | null; onProgress: (done: number) => void }) => {
      const failed: Array<{ name: string; error: unknown }> = [];
      for (const [index, file] of files.entries()) {
        try {
          const body = new FormData();
          body.append('file', file);
          const { url } = await api.post<{ url: string }>('/api/admin/media', body);
          const title = titleFromFileName(file.name);
          await api.post('/api/admin/portfolio', {
            imageUrl: url,
            categoryId,
            isFeatured: false,
            isPublished: false,
            isSample: false,
            allowSimilarRequest: true,
            translations: { 'nl-BE': { title }, en: { title }, tr: { title } },
          });
        } catch (error) {
          failed.push({ name: file.name, error });
        }
        onProgress(index + 1);
      }
      return { added: files.length - failed.length, failed };
    },
    onSettled: refresh,
  });
}

/** "IMG_2041 kepenk-gent.jpg" → "IMG 2041 kepenk gent" (the artist edits it afterwards). */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (base || 'Foto').slice(0, 150);
}

export function usePortfolioActions() {
  const refresh = useRefreshCatalog();
  return {
    move: useMutation({
      mutationFn: (input: { id: string; direction: 'up' | 'down' }) => api.post<AdminPortfolioItemDto[]>('/api/admin/portfolio/reorder', input),
      onSuccess: refresh,
    }),
    setFeatured: useMutation({
      mutationFn: ({ id, value }: { id: string; value: boolean }) => api.post<AdminPortfolioItemDto>(`/api/admin/portfolio/${id}/featured`, { value }),
      onSuccess: refresh,
    }),
    setPublished: useMutation({
      mutationFn: ({ id, value }: { id: string; value: boolean }) => api.post<AdminPortfolioItemDto>(`/api/admin/portfolio/${id}/published`, { value }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/api/admin/portfolio/${id}`), onSuccess: refresh }),
  };
}

/* ---------- Page texts (phase 9b) ---------- */

export function useAdminContent() {
  return useQuery({
    queryKey: queryKeys.admin.content,
    queryFn: ({ signal }) => api.get<AdminContentDto>('/api/admin/content', undefined, signal),
  });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContentUpdateInput) => api.put<AdminContentDto>('/api/admin/content', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.content });
      void refreshSite(queryClient);
    },
  });
}
