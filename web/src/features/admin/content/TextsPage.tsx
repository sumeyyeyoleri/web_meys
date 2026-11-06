import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALES, type AdminContentDto, type ContentKey, type Locale } from '@painter/shared';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Input, Textarea } from '../../../components/ui/Inputs';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { cx } from '../../../components/ui/cx';
import { useLocale } from '../../../lib/i18n';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminContent, useUpdateContent } from '../hooks';
import { Section } from './Section';

/** The text blocks grouped by where they appear; `lines` = a short one-line text. */
const GROUPS: Array<{ id: string; keys: Array<{ key: ContentKey; rows?: number; line?: boolean }> }> = [
  {
    id: 'home',
    keys: [{ key: 'hero.eyebrow', line: true }, { key: 'hero.title', rows: 2 }, { key: 'hero.subtitle', rows: 3 }, { key: 'welcome.tagline', line: true }],
  },
  { id: 'about', keys: [{ key: 'about.title', line: true }, { key: 'about.body', rows: 8 }] },
  { id: 'contact', keys: [{ key: 'contact.intro', rows: 3 }, { key: 'contact.businessHours', rows: 3 }, { key: 'instagram.text', rows: 2 }] },
  { id: 'footer', keys: [{ key: 'footer.tagline', line: true }] },
  { id: 'privacy', keys: [{ key: 'privacy.body', rows: 16 }] },
];

const id = (key: ContentKey, locale: Locale) => `${key}|${locale}`;

function toMap(items: AdminContentDto['items']): Record<string, string> {
  return Object.fromEntries(items.map((item) => [id(item.key, item.locale), item.value]));
}

/** Page texts in Dutch, English and Turkish (PROMPT.md §10). Empty texts fall back to Dutch on the site. */
export function TextsPage() {
  const { t } = useTranslation('admin');
  const content = useAdminContent();
  return (
    <>
      <AdminPageHeader title={t('texts.title')} intro={t('texts.intro')} />
      {content.isPending ? (
        <LoadingBlock />
      ) : content.isError ? (
        <ErrorState error={content.error} onRetry={() => void content.refetch()} />
      ) : (
        <TextsForm items={content.data.items} />
      )}
    </>
  );
}

function TextsForm({ items }: { items: AdminContentDto['items'] }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const dashboardLocale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const update = useUpdateContent();
  const [saved, setSaved] = useState(() => toMap(items));
  const [values, setValues] = useState(saved);
  // Start with the dashboard language when it is one of the site languages.
  const [locale, setLocale] = useState<Locale>(LOCALES.includes(dashboardLocale) ? dashboardLocale : DEFAULT_LOCALE);

  const changed = Object.keys(values).filter((k) => values[k] !== saved[k]);
  const changedIn = (l: Locale) => changed.some((k) => k.endsWith(`|${l}`));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!changed.length) return;
    try {
      const result = await update.mutateAsync({
        items: changed.map((k) => {
          const [key, l] = k.split('|') as [ContentKey, Locale];
          return { key, locale: l, value: values[k] ?? '' };
        }),
      });
      const next = toMap(result.items);
      setSaved(next);
      setValues(next);
      toast.success(t('texts.saved'));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex max-w-3xl flex-col gap-6">
      {update.isError ? <FormAlert>{errorMessage(update.error)}</FormAlert> : null}
      <div role="group" aria-label={t('texts.language')} className="flex flex-wrap gap-2">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={locale === l}
            onClick={() => setLocale(l)}
            className={cx(
              'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
              locale === l ? 'border-accent bg-accent text-on-accent' : 'border-border-strong text-text-muted hover:text-text',
            )}
          >
            {tc(`language.${l}`)}
            {changedIn(l) ? (
              <>
                <span aria-hidden="true" className="size-2 rounded-full bg-current" />
                <span className="sr-only">({t('texts.unsavedIn')})</span>
              </>
            ) : null}
          </button>
        ))}
      </div>
      {locale !== DEFAULT_LOCALE ? <p className="text-sm text-text-muted">{t('texts.fallbackHint')}</p> : null}

      {GROUPS.map((group) => (
        <Section key={group.id} id={`texts-${group.id}`} title={t(`texts.groups.${group.id}`)}>
          {group.keys.map(({ key, rows, line }) => {
            const k = id(key, locale);
            const fallback = locale !== DEFAULT_LOCALE && !values[k]?.trim() ? values[id(key, DEFAULT_LOCALE)] : undefined;
            const props = {
              lang: locale,
              value: values[k] ?? '',
              placeholder: fallback,
              onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value })),
            };
            return (
              <Field key={k} label={t(`texts.keys.${key.replace('.', '_')}`)} hint={fallback ? t('texts.usesDutch') : undefined}>
                {(p) => (line ? <Input {...p} {...props} maxLength={20_000} /> : <Textarea {...p} {...props} rows={rows ?? 3} maxLength={20_000} />)}
              </Field>
            );
          })}
        </Section>
      ))}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-1 py-4 backdrop-blur">
        <Button type="submit" loading={update.isPending} disabled={!changed.length}>
          {t('texts.save')}
        </Button>
        {changed.length ? <span className="text-sm text-text-muted">{t('texts.unsaved', { count: changed.length })}</span> : null}
      </div>
    </form>
  );
}
