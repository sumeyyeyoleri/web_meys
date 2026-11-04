import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/States';
import { usePageTitle } from '../../lib/use-page-title';

/** Unknown page inside the dashboard (keeps the dashboard layout). */
export function AdminNotFound() {
  const { t } = useTranslation('admin');
  usePageTitle(t('notFound.title'));
  return (
    <EmptyState
      icon="alert"
      title={t('notFound.title')}
      description={t('notFound.body')}
      action={<ButtonLink to="/admin">{t('notFound.back')}</ButtonLink>}
    />
  );
}
