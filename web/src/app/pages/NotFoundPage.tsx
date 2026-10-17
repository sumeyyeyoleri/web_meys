import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../components/ui/Button';
import { usePageTitle } from '../../lib/use-page-title';

export function NotFoundPage() {
  const { t } = useTranslation();
  usePageTitle(t('pages.notFound.title'));
  return (
    <section className="container-content flex min-h-[70vh] flex-col items-center justify-center gap-6 pt-40 pb-24 text-center">
      <p className="eyebrow">{t('pages.notFound.eyebrow')}</p>
      <h1 className="text-5xl sm:text-7xl">{t('pages.notFound.title')}</h1>
      <p className="max-w-lg text-lg text-text-muted">{t('pages.notFound.body')}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">{t('actions.goHome')}</ButtonLink>
        <ButtonLink to="/catalog" variant="secondary">
          {t('pages.notFound.catalog')}
        </ButtonLink>
      </div>
    </section>
  );
}
