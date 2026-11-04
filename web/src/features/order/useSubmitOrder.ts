import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateOrderResultDto, TrackingLinkDto } from '@painter/shared';
import { api } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import type { OrderFile } from './order-form';

/** Router state of `/order/sent` (guest confirmation). The tracking link is only known here. */
export interface GuestConfirmationState {
  reference: string;
  tracking: TrackingLinkDto;
  email: string;
  inspirationTitle: string | null;
}

/** One multipart request: `data` = JSON order, `files` = reference images. */
export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, files }: { data: Record<string, unknown>; files: OrderFile[] }) => {
      const body = new FormData();
      body.append('data', JSON.stringify(data));
      for (const item of files) body.append('files', item.file, item.file.name);
      return api.post<CreateOrderResultDto>('/api/orders', body);
    },
    onSuccess: async (result) => {
      // Guest orders are not part of any account, so there is nothing to refresh for them.
      if (result.tracking) return;
      queryClient.setQueryData(queryKeys.orders.detail(result.order.id), result.order);
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
