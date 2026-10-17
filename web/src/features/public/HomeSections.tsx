import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ButtonLink, buttonClasses } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ArtworkImage } from './ArtworkImage';
import { useServices, useSite } from './hooks';
import { SectionHeading } from './SectionHeading';

export function HowItWorks() {
  const { t } = useTranslation('public');
  const steps = ['1', '2', '3', '4'] as const;
  return (
    <section aria-labelledby="how-title" className="container-content section flex flex-col gap-12">
      <SectionHeading id="how-title" eyebrow={t('how.eyebrow')} title={t('how.title')} />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li key={step} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-6">
            <span className="font-display text-5xl leading-none text-accent" aria-hidden="true">
              {step.padStart(2, '0')}
            </span>
            <h3 className="font-sans text-lg font-semibold">{t(`how.steps.${step}.title`)}</h3>
            <p className="text-text-muted">{t(`how.steps.${step}.body`)}</p>
          </li>
        ))}
      </ol>
      <ButtonLink to="/order" className="self-start">
        {t('how.cta')}
      </ButtonLink>
    </section>
  );
}

export function AboutSection() {
  const { data: site } = useSite();
  const title = site?.content['about.title'];
  const body = site?.content['about.body'];
  if (!title && !body) return null;
  return (
    <section aria-labelledby="about-title" className="container-content section grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
      <SectionHeading id="about-title" title={title} />
      {body ? <p className="text-lg whitespace-pre-line text-text-muted lg:pt-2">{body}</p> : null}
    </section>
  );
}

export function ServicesPreview() {
  const { t } = useTranslation('public');
  const { data: services } = useServices();
  if (!services?.length) return null;
  return (
    <section aria-labelledby="services-preview-title" className="container-content section flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading id="services-preview-title" eyebrow={t('servicesPreview.eyebrow')} title={t('servicesPreview.title')} />
        <Link to="/services" className={buttonClasses('ghost')}>
          {t('servicesPreview.all')}
          <Icon name="arrowRight" size={18} />
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <li key={service.id}>
            <Link
              to={`/order?service=${service.id}`}
              className="group flex h-full flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-3 transition-colors duration-300 hover:border-border-strong"
            >
              {service.imageUrl ? (
                <ArtworkImage src={service.imageUrl} alt="" className="aspect-[4/3] w-full" />
              ) : null}
              <span className="flex flex-col gap-1 px-2 pb-2">
                <span className="font-display text-2xl">{service.name}</span>
                {service.description ? <span className="line-clamp-3 text-sm text-text-muted">{service.description}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InstagramBand() {
  const { t } = useTranslation('public');
  const { t: tc } = useTranslation();
  const { data: site } = useSite();
  const url = site?.settings.instagramUrl;
  if (!url) return null;
  return (
    <section aria-labelledby="instagram-title" className="border-y border-border bg-surface">
      <div className="container-content flex flex-col items-start gap-6 py-14 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <p id="instagram-title" className="eyebrow">
            {t('instagram.eyebrow')}
          </p>
          <p className="max-w-xl font-display text-3xl">{site.content['instagram.text']}</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary')}>
          <Icon name="instagram" size={18} />
          {t('instagram.button')}
          <span className="sr-only">{tc('labels.opensInNewTab')}</span>
        </a>
      </div>
    </section>
  );
}
