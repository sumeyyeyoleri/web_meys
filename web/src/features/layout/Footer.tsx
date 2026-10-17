import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/ui/Icon';
import { usePortfolio, useSite } from '../public/hooks';
import { NAV_LINKS } from './nav-links';

export function Footer() {
  const { t } = useTranslation();
  const { data: site } = useSite();
  const { data: portfolio } = usePortfolio();
  const settings = site?.settings;
  const hasSamples = portfolio?.some((item) => item.isSample) ?? false;
  const linkClass = 'inline-flex min-h-11 items-center text-text-muted transition-colors hover:text-text';

  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div className="container-content grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <p className="font-display text-3xl text-text">{settings?.businessName}</p>
          {site?.content['footer.tagline'] ? <p className="max-w-sm text-text-muted">{site.content['footer.tagline']}</p> : null}
          {settings?.instagramUrl ? (
            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className={`${linkClass} gap-2 self-start`}>
              <Icon name="instagram" />
              {t('footer.instagram')}
              <span className="sr-only">{t('labels.opensInNewTab')}</span>
            </a>
          ) : null}
        </div>

        <nav aria-label={t('footer.navigation')}>
          <h2 className="eyebrow mb-2">{t('footer.navigation')}</h2>
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={linkClass}>
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/order" className={linkClass}>
                {t('nav.order')}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className={linkClass}>
                {t('footer.privacy')}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="eyebrow mb-2">{t('footer.contact')}</h2>
          <ul className="flex flex-col">
            {settings?.contactEmail ? (
              <li>
                <a href={`mailto:${settings.contactEmail}`} className={`${linkClass} gap-2 break-all`}>
                  <Icon name="mail" size={18} className="shrink-0" />
                  {settings.contactEmail}
                </a>
              </li>
            ) : null}
            {settings?.contactPhone ? (
              <li>
                <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, '')}`} className={`${linkClass} gap-2`}>
                  <Icon name="phone" size={18} className="shrink-0" />
                  {settings.contactPhone}
                </a>
              </li>
            ) : null}
            {settings?.contactAddress ? (
              <li className="flex gap-2 py-2.5 text-text-muted">
                <Icon name="pin" size={18} className="mt-0.5 shrink-0" />
                <span>{settings.contactAddress}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="container-content flex flex-col gap-2 border-t border-border py-6 text-sm text-text-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>{t('footer.rights', { year: new Date().getFullYear(), name: settings?.businessName ?? '' })}</p>
        {hasSamples ? <p>{t('footer.examplesNote')}</p> : null}
      </div>
    </footer>
  );
}
