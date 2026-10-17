import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UserDto } from '@painter/shared';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../lib/api';
import { setLocale } from '../../lib/i18n';
import { queryKeys } from '../../lib/query-keys';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.get<{ user: UserDto | null }>('/api/auth/me', undefined, signal),
    staleTime: 60_000,
    select: (data) => data.user,
  });
}

/** Stores the signed-in user and switches to their preferred language. */
export function useApplySignedInUser() {
  const queryClient = useQueryClient();
  return async (user: UserDto) => {
    queryClient.setQueryData(queryKeys.me, { user });
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    await setLocale(user.preferredLocale);
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.me, { user: null });
      for (const key of [queryKeys.orders.all, queryKeys.notifications.all, queryKeys.admin.all]) {
        queryClient.removeQueries({ queryKey: key });
      }
      toast.success(t('toast.loggedOut'));
      navigate('/');
    },
    onError: () => toast.error(t('errors.generic')),
  });
}
