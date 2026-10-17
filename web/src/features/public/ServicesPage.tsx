import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { usePageTitle } from '../../lib/use-page-title';
import { ArtworkImage } from './ArtworkImage';
import { useServices } from './hooks';

export function ServicesPage() {
  const { t } = useTranslation('public');
  const { t: tc } = useTranslation();
  usePageTitle(t('meta.servicesTitle'));
  const services = useServices();

  return (
    <div className="container-content flex flex-col gap-12 pt-36 pb-24 sm:pt-44">
      <header className="flex flex-col gap-4">
        <h1 className="text-5xl sm:text-7xl">{t('services.title')}</h1>
        <p className="max-w-2xl text-lg text-text-muted">{t('services.intro')}</p>
      </header>

      {services.isPending ? (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[420px] w-full rounded-[var(--radius-panel)]" />
          ))}
        </div>
      ) : services.isError ? (
        <ErrorState error={services.error} onRetry={() => void services.refetch()} />
      ) : services.data.length === 0 ? (
        <EmptyState title={t('services.empty')} />
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {services.data.map((service) => (
            <li key={service.id} className="flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
              {service.imageUrl ? <ArtworkImage src={service.imageUrl} alt="" className="aspect-[16/10] w-full rounded-none" /> : null}
              <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-4xl">{service.name}</h2>
                  {service.isWallService ? <Badge>{t('services.wall')}</Badge> : null}
                </div>
                {service.description ? <p className="text-text-muted">{service.description}</p> : null}
                <p className="text-sm text-text-subtle">{tc('labels.personalQuote')}</p>
                <ButtonLink
                  to={`/order?service=${service.id}`}
                  className="mt-auto self-start"
                  aria-label={t('services.requestFor', { name: service.name })}
                >
                  {t('services.request')}
                  <Icon name="arrowRight" size={18} />
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] border border-dashed border-border-strong p-6 sm:p-10">
        <h2 className="text-4xl">{t('services.customTitle')}</h2>
        <p className="max-w-xl text-text-muted">{t('services.customBody')}</p>
        <Link to="/order" className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline">
          {t('services.customCta')}
          <Icon name="arrowRight" size={18} />
        </Link>
      </section>
    </div>
  );
}
