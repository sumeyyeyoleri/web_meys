import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cx } from '../../components/ui/cx';
import { useMe } from '../auth/hooks';

/** Back to the dashboard — only while the artist is signed in (customers have no account). */
export function DashboardLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { t } = useTranslation();
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <Link
      to="/admin"
      onClick={onClick}
      className={cx('inline-flex min-h-11 items-center px-3 text-sm font-semibold text-text-muted transition-colors hover:text-text', className)}
    >
      {t('nav.dashboard')}
    </Link>
  );
}
