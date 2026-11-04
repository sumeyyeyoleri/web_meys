import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateOrderResultDto } from '@painter/shared';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import type { WizardFile } from './wizard-model';

/** One multipart request: `data` = JSON order, `files` = reference images. */
export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, files }: { data: Record<string, unknown>; files: WizardFile[] }) => {
      const body = new FormData();
      body.append('data', JSON.stringify(data));
      for (const item of files) body.append('files', item.file, item.file.name);
      return api.post<CreateOrderResultDto>('/api/orders', body);
    },
    onSuccess: async (result) => {
      // A guest is now signed in with the account created together with the order.
      queryClient.setQueryData(queryKeys.me, { user: result.user });
      queryClient.setQueryData(queryKeys.orders.detail(result.order.id), result.order);
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
