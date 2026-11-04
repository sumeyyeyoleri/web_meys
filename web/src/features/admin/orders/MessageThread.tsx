import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MESSAGE_MAX_LENGTH } from '@painter/shared';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Inputs';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { cx } from '../../../components/ui/cx';
import { formatDateTime } from '../../../lib/format';
import { useLocale } from '../../../lib/i18n';
import { LanguageTag, TranslatableText } from '../../messages/message-language';
import { translateOrderMessage, useMarkMessagesRead, useOrderMessages, useSendMessage } from '../hooks';

/** Thread with the customer; opening it (and new customer messages) marks them as read. */
export function MessageThread({ orderId, hasEmail }: { orderId: string; hasEmail: boolean }) {
  const { t } = useTranslation('admin');
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const messages = useOrderMessages(orderId);
  const send = useSendMessage(orderId);
  const markRead = useMarkMessagesRead(orderId);
  const translate = useMemo(() => translateOrderMessage(orderId), [orderId]);
  const [body, setBody] = useState('');
  const unreadFromCustomer = messages.data?.some((m) => m.senderRole === 'CUSTOMER' && !m.readAt) ?? false;
  const markReadRef = useRef(markRead.mutate);
  markReadRef.current = markRead.mutate;

  useEffect(() => {
    if (unreadFromCustomer) markReadRef.current();
  }, [unreadFromCustomer]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate(text, {
      onSuccess: () => setBody(''),
      onError: (error) => toast.error(errorMessage(error)),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {messages.isPending ? (
        <LoadingBlock />
      ) : messages.isError ? (
        <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
      ) : messages.data.length === 0 ? (
        <p className="text-text-muted">{t('messages.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-3" aria-live="polite">
          {messages.data.map((message) => {
            const fromArtist = message.senderRole === 'ADMIN';
            return (
              <li key={message.id} className={cx('flex flex-col gap-1', fromArtist ? 'items-end' : 'items-start')}>
                <div
                  className={cx(
                    'max-w-[85%] rounded-[var(--radius-card)] border px-4 py-3',
                    fromArtist ? 'border-accent/50 bg-selected whitespace-pre-line' : 'border-border bg-surface',
                  )}
                >
                  {/* The customer's messages can be translated into the dashboard language. */}
                  {fromArtist ? message.body : <TranslatableText message={message} translate={translate} />}
                </div>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-text-subtle">
                  <LanguageTag locale={message.locale} />
                  <span>
                    {fromArtist ? t('messages.you') : message.senderName} · {formatDateTime(message.createdAt, locale)}
                    {fromArtist ? ` · ${message.readAt ? t('messages.read') : t('messages.notRead')}` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label={t('messages.reply')} hint={hasEmail ? t('messages.replyHintEmail') : t('messages.replyHintNoEmail')}>
          {(p) => <Textarea {...p} rows={3} maxLength={MESSAGE_MAX_LENGTH} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <Button type="submit" loading={send.isPending} disabled={!body.trim()} className="self-start">
          {t('messages.send')}
        </Button>
      </form>
    </div>
  );
}
