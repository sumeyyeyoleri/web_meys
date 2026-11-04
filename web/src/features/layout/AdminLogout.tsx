import { useTranslation } from 'react-i18next';
import { cx } from '../../components/ui/cx';
import { useLogout, useMe } from '../auth/hooks';

/**
 * Shown only while the artist is signed in (customers have no account, so visitors never see
 * it). Until the dashboard exists (phase 9) this is the way to sign out.
 */
export function AdminLogout({ className, onDone }: { className?: string; onDone?: () => void }) {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const logout = useLogout();
  if (!user) return null;
  return (
    <button
      type="button"
      disabled={logout.isPending}
      title={t('nav.signedInAs', { email: user.email })}
      onClick={() => {
        onDone?.();
        logout.mutate();
      }}
      className={cx('inline-flex min-h-11 items-center px-3 text-sm font-semibold text-text-muted transition-colors hover:text-text', className)}
    >
      {t('nav.logout')}
    </button>
  );
}
