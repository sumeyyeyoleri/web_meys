import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/ui/Icon';
import { Skeleton } from '../../components/ui/Spinner';
import { usePageTitle } from '../../lib/use-page-title';
import { useSite } from './hooks';

export function PrivacyPage() {
  const { t } = useTranslation('public');
  usePageTitle(t('meta.privacyTitle'));
  const { data: site, isPending } = useSite();
  const body = site?.content['privacy.body'];

  return (
    <article className="container-content flex max-w-3xl flex-col gap-8 pt-36 pb-24 sm:pt-44">
      <h1 className="text-5xl sm:text-6xl">{t('privacy.title')}</h1>
      {/* Visible reminder: the policy is placeholder text and is not legal advice. */}
      <div role="note" className="flex gap-3 rounded-[var(--radius-card)] border border-status-amber/50 bg-status-amber/10 p-4 text-text">
        <Icon name="alert" className="mt-0.5 shrink-0 text-status-amber" />
        <p>{t('privacy.notice')}</p>
      </div>
      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ) : body ? (
        <div className="text-lg leading-relaxed whitespace-pre-line text-text-muted">{body}</div>
      ) : (
        <p className="text-text-muted">{t('privacy.empty')}</p>
      )}
    </article>
  );
}
