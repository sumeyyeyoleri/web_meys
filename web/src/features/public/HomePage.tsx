import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../components/ui/Spinner';
import { usePageTitle } from '../../lib/use-page-title';
import { useSite } from './hooks';

export function HomePage() {
  const { t } = useTranslation('public');
  const { data: site, isPending } = useSite();
  usePageTitle(t('meta.homeTitle'));

  return (
    <section className="container-content flex min-h-[70vh] flex-col items-center justify-center gap-6 pt-44 pb-20 text-center">
      {isPending ? (
        <>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-16 w-full max-w-2xl" />
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
