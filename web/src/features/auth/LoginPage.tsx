import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ui/Toast';
import { safeNextPath } from '../../lib/form-errors';
import { usePageTitle } from '../../lib/use-page-title';
import { AuthCard } from './AuthCard';
import { useMe } from './hooks';
import { LoginForm } from './LoginForm';

export function LoginPage() {
  const { t } = useTranslation('account');
  usePageTitle(t('meta.loginTitle'));
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: user } = useMe();
  const next = safeNextPath(params.get('next'));
  const registerHref = params.get('next') ? `/register?next=${encodeURIComponent(next)}` : '/register';

  if (user) return <Navigate to={next} replace />;

  return (
    <AuthCard
      title={t('login.title')}
      intro={t('login.intro')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link to={registerHref} className="inline-flex min-h-11 items-center font-semibold text-text underline underline-offset-4">
            {t('login.register')}
          </Link>
        </>
      }
    >
      <LoginForm
        onSuccess={() => {
          toast.success(t('login.welcome'));
          navigate(next, { replace: true });
        }}
      />
    </AuthCard>
  );
}
