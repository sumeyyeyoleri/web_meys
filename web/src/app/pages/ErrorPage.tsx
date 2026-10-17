import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, buttonClasses } from '../../components/ui/Button';
import { NotFoundPage } from './NotFoundPage';

/** Router error boundary: shown when a page fails to render. */
export function ErrorPage() {
  const error = useRouteError();
  const { t } = useTranslation();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <main className="container-content flex min-h-dvh flex-col items-center justify-center gap-6 py-24 text-center">
      <p className="eyebrow">{t('pages.error.eyebrow')}</p>
      <h1 className="text-5xl sm:text-6xl">{t('pages.error.title')}</h1>
      <p className="max-w-lg text-lg text-text-muted">{t('pages.error.body')}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>{t('actions.reload')}</Button>
        <Link to="/" className={buttonClasses('secondary')} reloadDocument>
          {t('actions.goHome')}
        </Link>
      </div>
    </main>
  );
}
