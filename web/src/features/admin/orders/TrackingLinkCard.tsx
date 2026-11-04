import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrackingLinkDto } from '@painter/shared';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Input } from '../../../components/ui/Inputs';
import { useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { useNewTrackingLink } from '../hooks';

/**
 * "Create new tracking link": revokes the old links; the new one is shown only here, once
 * (only its hash is stored), and emailed when the order has an address and SMTP works.
 */
export function TrackingLinkCard({ orderId, email }: { orderId: string; email: string | null }) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const create = useNewTrackingLink(orderId);
  const [confirming, setConfirming] = useState(false);
  const [link, setLink] = useState<TrackingLinkDto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('tracking.copied'));
    } catch {
      inputRef.current?.select();
      toast.show(t('tracking.copyManually'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{t('tracking.intro')}</p>
      {link ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="new-tracking-link" className="text-sm font-semibold">
            {t('tracking.newLink')}
          </label>
          <Input id="new-tracking-link" ref={inputRef} readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} className="font-mono" />
          <Button variant="secondary" size="sm" onClick={() => void copy(link.url)} className="self-start">
            {t('tracking.copy')}
          </Button>
          <FormAlert tone={link.emailSent ? 'success' : 'info'}>
            {link.emailSent ? t('tracking.emailed', { email }) : email ? t('tracking.notEmailed') : t('tracking.noEmail')}
          </FormAlert>
          <p className="text-sm text-text-subtle">{t('tracking.onceOnly')}</p>
        </div>
      ) : null}
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)} className="self-start">
        {t('tracking.create')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          create.mutate(undefined, {
            onSuccess: (result) => {
              setConfirming(false);
              setLink(result);
            },
            onError: (error) => {
              setConfirming(false);
              toast.error(errorMessage(error));
            },
          })
        }
        loading={create.isPending}
        title={t('tracking.confirmTitle')}
        description={t('tracking.confirmBody')}
        confirmLabel={t('tracking.create')}
        destructive
      />
    </div>
  );
}
