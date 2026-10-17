import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../components/ui/Spinner';
import { usePageTitle } from '../../lib/use-page-title';
import { ContactDetails } from './ContactDetails';
import { FeaturedGallery } from './FeaturedGallery';
import { useSite } from './hooks';
import { AboutSection, HowItWorks, InstagramBand, ServicesPreview } from './HomeSections';

function Hero() {
  const { data: site, isPending } = useSite();
  return (
    <section className="container-content flex flex-col items-center gap-6 pt-40 pb-12 text-center sm:pt-48 sm:pb-16">
      {isPending ? (
        <>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-28 w-full max-w-3xl" />
          <Skeleton className="h-6 w-full max-w-lg" />
        </>
      ) : (
        <>
          {site?.content['hero.eyebrow'] ? <p className="eyebrow">{site.content['hero.eyebrow']}</p> : null}
          <h1 className="max-w-4xl text-[44px] leading-[1.1] text-balance sm:text-[64px] lg:text-[80px]">
            {site?.content['hero.title']}
          </h1>
          {site?.content['hero.subtitle'] ? (
            <p className="max-w-2xl text-lg text-pretty text-text-muted">{site.content['hero.subtitle']}</p>
          ) : null}
        </>
      )}
    </section>
  );
}

export function HomePage() {
  const { t } = useTranslation('public');
  usePageTitle(t('meta.homeTitle'));
  return (
    <>
      <Hero />
      <FeaturedGallery />
      <HowItWorks />
      <AboutSection />
      <ServicesPreview />
      <InstagramBand />
      <section aria-labelledby="contact-title" className="container-content section">
        <ContactDetails />
      </section>
    </>
  );
}
