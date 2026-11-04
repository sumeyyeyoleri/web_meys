import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminStatusChangeSchema, type AdminOrderDetailDto, type OrderStatus } from '@painter/shared';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Field, FieldError } from '../../../components/ui/Field';
import { ChoiceCard, Input, Textarea } from '../../../components/ui/Inputs';
import { useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { isApiError } from '../../../lib/api';
import { formatCurrency } from '../../../lib/format';
import { useLocale, useValidationMessage } from '../../../lib/i18n';
import { useChangeStatus } from '../hooks';

/**
 * Status change: only the transitions the API allows (`allowedTransitions`), a quote amount for
 * QUOTE_SENT, an optional note, and a confirmation before anything changes.
 */
export function StatusPanel({ order }: { order: AdminOrderDetailDto }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const translate = useValidationMessage();
  const change = useChangeStatus(order.id);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [quote, setQuote] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  if (order.allowedTransitions.length === 0) {
    return <p className="text-sm text-text-muted">{order.archivedAt ? t('status.archived') : t('status.final')}</p>;
  }

  const parsed = adminStatusChangeSchema.safeParse({ status, quoteAmount: status === 'QUOTE_SENT' ? quote : '', note });

  function review() {
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join('.')] ??= issue.message;
      setErrors(fields);
      return;
    }
    setErrors({});
    setConfirming(true);
  }

  function apply() {
    if (!parsed.success) return;
    change.mutate(parsed.data, {
      onSuccess: () => {
        setConfirming(false);
        setStatus('');
        setQuote('');
        setNote('');
        toast.success(t('status.changed', { status: tc(`status.${parsed.data.status}`) }));
      },
      onError: (error) => {
        setConfirming(false);
        if (isApiError(error) && Object.keys(error.fields).length) setErrors(error.fields);
        else toast.error(errorMessage(error));
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2" aria-describedby={errors.status ? 'status-error' : undefined}>
        <legend className="mb-2 text-sm font-semibold">{t('status.choose')}</legend>
        {order.allowedTransitions.map((option) => (
          <ChoiceCard
            key={option}
            id={`status-${option}`}
            name="next-status"
            value={option}
            checked={status === option}
            onChange={() => setStatus(option)}
            title={tc(`status.${option}`)}
            className="p-3"
          />
        ))}
        {errors.status ? <FieldError id="status-error">{translate(errors.status)}</FieldError> : null}
      </fieldset>
      {status === 'QUOTE_SENT' ? (
        <Field label={t('status.quoteAmount')} hint={t('status.quoteHint')} error={errors.quoteAmount} required>
          {(p) => <Input {...p} type="text" inputMode="decimal" autoComplete="off" value={quote} onChange={(e) => setQuote(e.target.value)} />}
        </Field>
      ) : null}
      {status ? (
        <Field label={t('status.note')} hint={t('status.noteHint')} error={errors.note} optional>
          {(p) => <Textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      ) : null}
      <Button onClick={review} disabled={!status} className="self-start">
        {t('status.submit')}
      </Button>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={apply}
        loading={change.isPending}
        title={t('status.confirmTitle')}
        description={
          parsed.success
            ? t(parsed.data.quoteAmount !== undefined ? 'status.confirmBodyQuote' : 'status.confirmBody', {
                from: tc(`status.${order.status}`),
                to: tc(`status.${parsed.data.status}`),
                amount: parsed.data.quoteAmount !== undefined ? formatCurrency(parsed.data.quoteAmount, locale) : '',
              })
            : ''
        }
        confirmLabel={t('status.confirm')}
        destructive={status === 'CANCELLED'}
      />
    </div>
  );
}
