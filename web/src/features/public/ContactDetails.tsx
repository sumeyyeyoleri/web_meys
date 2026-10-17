import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useSite } from './hooks';
import { SectionHeading } from './SectionHeading';

/** Contact intro, details from settings and business hours (home section and contact page). */
export function ContactDetails({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const { t } = useTranslation('public');
  const { data: site } = useSite();
  if (!site) return null;
  const { settings, content } = site;
  const row = 'flex min-h-11 items-center gap-3 text-text transition-colors hover:text-accent';

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <div className="flex flex-col gap-6">
        {headingLevel === 1 ? (
          <div className="flex flex-col gap-3">
            <p className="eyebrow">{t('contact.eyebrow')}</p>
            <h1 className="text-5xl sm:text-6xl">{t('contact.title')}</h1>
          </div>
        ) : (
          <SectionHeading id="contact-title" eyebrow={t('contact.eyebrow')} title={t('contact.title')} />
        )}
        {content['contact.intro'] ? <p className="max-w-xl text-lg text-text-muted">{content['contact.intro']}</p> : null}
        <ButtonLink to="/order" className="self-start">
          {t('contact.orderCta')}
        </ButtonLink>
      </div>
      <div className="flex flex-col gap-6 rounded-[var(--radius-panel)] border border-border bg-surface p-6 sm:p-8">
        <ul className="flex flex-col gap-1">
          {settings.contactEmail ? (
            <li>
              <a href={`mailto:${settings.contactEmail}`} className={`${row} break-all`}>
                <Icon name="mail" className="shrink-0 text-text-subtle" />
                <span className="sr-only">{t('contact.email')}: </span>
                {settings.contactEmail}
              </a>
            </li>
          ) : null}
          {settings.contactPhone ? (
            <li>
              <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, '')}`} className={row}>
                <Icon name="phone" className="shrink-0 text-text-subtle" />
                <span className="sr-only">{t('contact.phone')}: </span>
                {settings.contactPhone}
              </a>
            </li>
          ) : null}
          {settings.contactAddress ? (
            <li className="flex gap-3 py-2.5 text-text">
              <Icon name="pin" className="mt-0.5 shrink-0 text-text-subtle" />
              <span className="sr-only">{t('contact.address')}: </span>
              <span>{settings.contactAddress}</span>
            </li>
          ) : null}
        </ul>
        {content['contact.businessHours'] ? (
          <div className="border-t border-border pt-5">
            <h3 className="eyebrow mb-2 font-sans">{t('contact.hours')}</h3>
            <p className="whitespace-pre-line text-text-muted">{content['contact.businessHours']}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
