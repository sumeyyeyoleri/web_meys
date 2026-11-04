import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, ButtonLink } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Inputs';
import { useToast } from '../../components/ui/Toast';
import { useLocale } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { usePageTitle } from '../../lib/use-page-title';
import { NextSteps } from './NextSteps';
import type { GuestConfirmationState } from './useSubmitOrder';

/**
 * Shown once after a guest submitted: the reference and the private tracking link. The link is
 * only in the router state (it survives a reload of this tab, but is never stored by the site).
 */
export function GuestConfirmationPage() {
  const { t } = useTranslation('order');
  usePageTitle(t('meta.confirmationTitle'));
  const locale = useLocale();
  const toast = useToast();
  const linkRef = useRef<HTMLInputElement>(null);
  const state = useLocation().state as GuestConfirmationState | null;

  if (!state?.tracking) {
    return (
      <div className="container-content flex justify-center pt-36 pb-24 sm:pt-44">
        <div className="flex w-full max-w-2xl flex-col gap-6 text-center">
          <h1 className="text-5xl">{t('sent.missingTitle')}</h1>
          <p className="text-text-muted">{t('sent.missingBody')}</p>
          <ButtonLink to="/" variant="secondary" className="self-center">
            {t('confirmation.home')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { reference, tracking, email, inspirationTitle } = state;

  async function copy() {
    try {
      await navigator.clipboard.writeText(tracking.url);
      toast.success(t('sent.copied'));
    } catch {
      // Clipboard not available (e.g. permissions): select the text so it can be copied by hand.
      linkRef.current?.select();
      toast.show(t('sent.copyManually'));
    }
  }

  return (
    <div className="container-content flex justify-center pt-36 pb-24 sm:pt-44">
      <div className="flex w-full max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-4 text-center">
          <p className="eyebrow">{t('confirmation.eyebrow')}</p>
          <h1 className="text-5xl sm:text-6xl">{t('confirmation.title')}</h1>
          <div className="mx-auto mt-2 flex flex-col items-center gap-1 rounded-[var(--radius-card)] border border-accent/60 bg-selected px-8 py-4">
            <span className="text-sm text-text-muted">{t('confirmation.reference')}</span>
            <span className="font-sans text-2xl font-semibold tracking-[0.08em] text-text">{reference}</span>
          </div>
          {inspirationTitle ? <p className="text-text-muted">{t('inspiration.inspiredBy', { title: inspirationTitle })}</p> : null}
        </header>

        <section aria-labelledby="link-title" className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-accent/60 bg-surface p-6 sm:p-8">
          <h2 id="link-title" className="text-3xl">
            {t('sent.linkTitle')}
          </h2>
          <p className="text-text-muted">{t('sent.linkIntro')}</p>
          <label htmlFor="tracking-link" className="sr-only">
            {t('sent.linkLabel')}
          </label>
          <Input id="tracking-link" ref={linkRef} readOnly value={tracking.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-base" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => void copy()}>{t('sent.copy')}</Button>
            <ButtonLink to={new URL(tracking.url).pathname + new URL(tracking.url).hash} variant="secondary">
              {t('sent.open')}
            </ButtonLink>
          </div>
          <FormAlert tone="info">
            <p className="font-semibold">{t('sent.saveWarning')}</p>
            <p className="mt-1 text-text-muted">{t('sent.saveWarningBody', { date: formatDate(tracking.expiresAt, locale) })}</p>
          </FormAlert>
          {tracking.emailSent ? <FormAlert tone="success">{t('sent.emailed', { email })}</FormAlert> : null}
        </section>

        <NextSteps where="link" />

        <ButtonLink to="/" variant="secondary" className="self-center">
          {t('confirmation.home')}
        </ButtonLink>
      </div>
    </div>
  );
}
