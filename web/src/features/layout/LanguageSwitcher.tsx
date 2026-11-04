import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@painter/shared';
import { cx } from '../../components/ui/cx';
import { setLocale, useLocale } from '../../lib/i18n';
import { useSite } from '../public/hooks';

const SHORT: Record<Locale, string> = { 'nl-BE': 'NL', en: 'EN', tr: 'TR' };

interface LanguageSwitcherProps {
  size?: 'sm' | 'lg';
  className?: string;
  /** Instead of only switching the UI (e.g. the dashboard also saves the artist's choice). */
  onSelect?: (locale: Locale) => void;
  /** The dashboard offers every language, also those disabled for the public site. */
  allLocales?: boolean;
}

/** NL / EN / TR — only the languages the admin enabled; the active one is full white. */
export function LanguageSwitcher({ size = 'sm', className, onSelect, allLocales }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const active = useLocale();
  const { data: site } = useSite();
  const enabled = site?.settings.enabledLocales ?? [...LOCALES];
  const locales = allLocales ? [...LOCALES] : LOCALES.filter((locale) => enabled.includes(locale) || locale === DEFAULT_LOCALE);

  return (
    <div role="group" aria-label={t('language.choose')} className={cx('flex items-center', className)}>
      {locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={isActive}
            aria-label={t(`language.${locale}`)}
            onClick={() => (onSelect ? onSelect(locale) : void setLocale(locale))}
            className={cx(
              'inline-flex min-h-11 items-center justify-center font-semibold tracking-[0.08em] transition-colors duration-300',
              size === 'sm' ? 'min-w-9 px-1.5 text-xs' : 'min-w-14 px-3 text-base',
              isActive ? 'text-text' : 'text-text-subtle hover:text-text-muted',
            )}
          >
            {SHORT[locale]}
          </button>
        );
      })}
    </div>
  );
}
