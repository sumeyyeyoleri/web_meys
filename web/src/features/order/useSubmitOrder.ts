import { useMutation } from '@tanstack/react-query';
import type { CreateOrderResultDto, TrackingLinkDto } from '@painter/shared';
import { api } from '../../lib/api';
import type { OrderFile } from './order-form';

/** Router state of `/order/sent`. The tracking link is only known here. */
export interface ConfirmationState {
  reference: string;
  tracking: TrackingLinkDto;
  /** The address the link was emailed to, if the customer gave one. */
  email: string | null;
  inspirationTitle: string | null;
}

/** One multipart request: `data` = JSON order, `files` = reference images. */
export function useSubmitOrder() {
  return useMutation({
    mutationFn: ({ data, files }: { data: Record<string, unknown>; files: OrderFile[] }) => {
      const body = new FormData();
      body.append('data', JSON.stringify(data));
      for (const item of files) body.append('files', item.file, item.file.name);
      return api.post<CreateOrderResultDto>('/api/orders', body);
    },
  });
}
