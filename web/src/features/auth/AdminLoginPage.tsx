import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/Toast';
import { safeNextPath } from '../../lib/form-errors';
import { usePageTitle } from '../../lib/use-page-title';
import { AdminAuthCard } from './AdminAuthCard';
import { useMe } from './hooks';
import { LoginForm } from './LoginForm';

/** `/admin/login` — the only login of the site (the artist's). */
export function AdminLoginPage() {
  const { t } = useTranslation('account');
  usePageTitle(t('meta.loginTitle'));
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: user } = useMe();
  const next = safeNextPath(params.get('next'), '/admin');

  if (user) return <Navigate to={next} replace />;

  return (
    <AdminAuthCard
      intro={t('login.intro')}
      footer={
        <Link to="/" className="inline-flex min-h-11 items-center text-sm underline-offset-4 hover:text-text hover:underline">
          {t('admin.toSite')}
        </Link>
      }
    >
      <LoginForm
        onSuccess={() => {
          toast.success(t('login.welcome'));
          navigate(next, { replace: true });
        }}
      />
    </AdminAuthCard>
  );
}
