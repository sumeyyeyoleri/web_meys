import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Locale, MessageDto, MessageTranslationDto } from '@painter/shared';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { useErrorMessage } from '../../components/ui/States';
import { useLocale } from '../../lib/i18n';
import { useSite } from '../public/hooks';

const SHORT: Record<Locale, string> = { 'nl-BE': 'NL', en: 'EN', tr: 'TR' };

/** Small NL/EN/TR tag with the sender's language (dashboard and tracking page). */
export function LanguageTag({ locale }: { locale: Locale }) {
  const { t } = useTranslation();
  return (
    <span
      className="rounded-full border border-border px-1.5 text-[11px] leading-4 font-semibold tracking-[0.06em] text-text-muted"
      title={t('messages.languageTag', { language: t(`language.${locale}`) })}
    >
      <span aria-hidden="true">{SHORT[locale]}</span>
      <span className="sr-only">{t('messages.languageTag', { language: t(`language.${locale}`) })}</span>
    </span>
  );
}

export type TranslateMessage = (messageId: string, targetLocale: Locale) => Promise<MessageTranslationDto>;

/**
 * Message text with an on-demand "Translate" button (into the current site/dashboard language)
 * and "Show original". Nothing is translated automatically; the server caches each translation.
 * Without a DeepL key (`translationAvailable` false) only the text is shown.
 */
export function TranslatableText({ message, translate }: { message: MessageDto; translate: TranslateMessage }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: site } = useSite();
  const errorMessage = useErrorMessage();
  const [translation, setTranslation] = useState<MessageTranslationDto | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const mutation = useMutation({
    mutationFn: () => translate(message.id, locale),
    onSuccess: (result) => {
      setTranslation(result);
      setShowTranslation(true);
    },
  });

  const canTranslate = !!site?.settings.translationAvailable && message.locale !== locale;
  // A translation into another language (the language was switched since) is not shown.
  const current = translation?.locale === locale ? translation : null;
  const showing = showTranslation && current;

  function onTranslate() {
    if (current) setShowTranslation(true);
    else mutation.mutate();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-line" lang={showing ? locale : message.locale}>
        {showing ? current.body : message.body}
      </p>
      {showing ? <p className="text-xs text-text-subtle">{t('messages.translated')}</p> : null}
      {canTranslate ? (
        <div className="flex flex-col items-start gap-1">
          {showing ? (
            <button type="button" onClick={() => setShowTranslation(false)} className="min-h-11 text-sm text-text-muted underline underline-offset-4 hover:text-text">
              {t('messages.showOriginal')}
            </button>
          ) : (
            <button
              type="button"
              onClick={onTranslate}
              disabled={mutation.isPending}
              aria-busy={mutation.isPending || undefined}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-text-muted underline underline-offset-4 hover:text-text disabled:opacity-60"
            >
              {mutation.isPending ? <Spinner size={14} /> : <Icon name="translate" size={16} />}
              {mutation.isPending ? t('messages.translating') : t('messages.translate')}
            </button>
          )}
          {mutation.isError && !mutation.isPending ? (
            <p role="alert" className="text-sm text-status-red">
              {errorMessage(mutation.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
