import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_LOCALE,
  HEX_COLOR_PATTERN,
  LOCALES,
  LOGO_MAX_FILE_SIZE_BYTES,
  MEDIA_MAX_FILE_SIZE_BYTES,
  siteSettingsSchema,
  type AdminSettingsDto,
  type Locale,
} from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Checkbox, Input, Textarea } from '../../../components/ui/Inputs';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { onAccentColor } from '../../../lib/accent';
import { mediaUrl } from '../../../lib/api';
import { applyApiFieldErrors } from '../../../lib/form-errors';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminSettings, useRemoveLogo, useUpdateSettings, useUploadLogo, useUploadMedia } from '../hooks';
import { Section } from './Section';
import { UploadButton } from './UploadButton';

type Values = z.input<typeof siteSettingsSchema>;
type Output = z.output<typeof siteSettingsSchema>;

const MB = 1024 * 1024;

function toValues(settings: AdminSettingsDto): Values {
  return {
    businessName: settings.businessName,
    accentColor: settings.accentColor,
    instagramUrl: settings.instagramUrl ?? '',
    contactEmail: settings.contactEmail ?? '',
    contactPhone: settings.contactPhone ?? '',
    contactAddress: settings.contactAddress ?? '',
    enabledLocales: settings.enabledLocales,
    emailNotificationsEnabled: settings.emailNotificationsEnabled,
    welcomeEnabled: settings.welcomeEnabled,
    welcomeImageUrl: settings.welcomeImageUrl ?? '',
  };
}

/** Site settings: business details, logo, accent colour, languages, notifications, welcome screen (PROMPT.md §10). */
export function SettingsPage() {
  const { t } = useTranslation('admin');
  const settings = useAdminSettings();
  return (
    <>
      <AdminPageHeader title={t('settings.title')} intro={t('settings.intro')} />
      {settings.isPending ? (
        <LoadingBlock />
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <div className="flex max-w-2xl flex-col gap-6">
          <LogoSection settings={settings.data} />
          <SettingsForm settings={settings.data} />
        </div>
      )}
    </>
  );
}

function LogoSection({ settings }: { settings: AdminSettingsDto }) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const upload = useUploadLogo();
  const remove = useRemoveLogo();
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <Section id="logo" title={t('settings.logoTitle')} intro={t('settings.logoIntro')}>
      <div className="flex min-h-24 items-center justify-center rounded-[var(--radius-card)] border border-border bg-bg p-4">
        {settings.logoUrl ? (
          <img src={mediaUrl(settings.logoUrl)} alt={t('settings.logoCurrent')} className="max-h-20 w-auto max-w-full" />
        ) : (
          <span className="font-display text-3xl">{settings.businessName}</span>
        )}
      </div>
      <p id="logo-hint" className="text-sm text-text-muted">
        {settings.logoUrl ? null : `${t('settings.logoNone')} `}
        {t('settings.logoHint', { mb: LOGO_MAX_FILE_SIZE_BYTES / MB })}
      </p>
      <div className="flex flex-wrap gap-3">
        <UploadButton
          label={settings.logoUrl ? t('settings.logoReplace') : t('settings.logoUpload')}
          accept="image/svg+xml,image/png,image/webp,.svg,.png,.webp"
          loading={upload.isPending}
          describedBy="logo-hint"
          onFiles={([file]) =>
            file &&
            upload.mutate(file, {
              onSuccess: () => toast.success(t('settings.logoSaved')),
              onError: (error) => toast.error(errorMessage(error)),
            })
          }
        />
        {settings.logoUrl ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
            {t('settings.logoRemove')}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirmRemove(false);
              toast.success(t('settings.logoRemoved'));
            },
            onError: (error) => {
              setConfirmRemove(false);
              toast.error(errorMessage(error));
            },
          })
        }
        loading={remove.isPending}
        title={t('settings.logoRemoveTitle')}
        description={t('settings.logoRemoveBody')}
        confirmLabel={t('settings.logoRemove')}
      />
    </Section>
  );
}

function SettingsForm({ settings }: { settings: AdminSettingsDto }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const update = useUpdateSettings();
  const uploadWelcome = useUploadMedia();
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(siteSettingsSchema), defaultValues: toValues(settings) });
  const { errors, isDirty } = form.formState;
  const r = form.register;

  const accent = form.watch('accentColor');
  const validAccent = HEX_COLOR_PATTERN.test(accent) ? accent : DEFAULT_ACCENT_COLOR;
  const locales = form.watch('enabledLocales');
  // A string in the form (the schema's preprocess widens the input type).
  const welcomeImage = form.watch('welcomeImageUrl') as string | undefined;

  function toggleLocale(locale: Locale, on: boolean) {
    const next = on ? [...locales, locale] : locales.filter((l) => l !== locale);
    form.setValue('enabledLocales', LOCALES.filter((l) => next.includes(l)), { shouldDirty: true });
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      form.reset(toValues(saved));
      toast.success(t('settings.saved'));
    } catch (error) {
      applyApiFieldErrors(error, form.setError, ['businessName', 'accentColor', 'instagramUrl', 'contactEmail', 'contactPhone', 'contactAddress', 'enabledLocales', 'welcomeImageUrl']);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {update.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(update.error)}</FormAlert> : null}

      <Section id="contact" title={t('settings.contactTitle')} intro={t('settings.contactIntro')}>
        <Field label={t('settings.businessName')} error={errors.businessName?.message} required>
          {(p) => <Input {...p} autoComplete="organization" {...r('businessName')} />}
        </Field>
        <Field label={t('settings.phone')} optional error={errors.contactPhone?.message}>
          {(p) => <Input {...p} type="tel" autoComplete="tel" {...r('contactPhone')} />}
        </Field>
        <Field label={t('settings.email')} optional error={errors.contactEmail?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...r('contactEmail')} />}
        </Field>
        <Field label={t('settings.address')} optional error={errors.contactAddress?.message}>
          {(p) => <Textarea {...p} rows={3} autoComplete="street-address" {...r('contactAddress')} />}
        </Field>
        <Field label={t('settings.instagram')} optional hint={t('settings.instagramHint')} error={errors.instagramUrl?.message}>
          {(p) => <Input {...p} type="url" inputMode="url" placeholder="https://www.instagram.com/…" {...r('instagramUrl')} />}
        </Field>
      </Section>

      <Section id="colour" title={t('settings.colourTitle')} intro={t('settings.colourIntro')}>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={t('settings.colourCode')} hint={t('settings.colourHint')} error={errors.accentColor?.message} required className="w-48">
            {(p) => <Input {...p} autoComplete="off" spellCheck={false} maxLength={7} {...r('accentColor')} />}
          </Field>
          <label className="mb-7 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input
              type="color"
              value={validAccent.toLowerCase()}
              onChange={(e) => form.setValue('accentColor', e.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: true })}
              className="size-11 cursor-pointer rounded-full border border-border-strong bg-transparent"
            />
            {t('settings.colourPick')}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3" aria-hidden="true">
          <span className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold" style={{ background: validAccent, color: onAccentColor(validAccent) }}>
            {t('settings.colourSample')}
          </span>
          <span className="text-sm" style={{ color: validAccent }}>
            {t('settings.colourSampleLink')}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="self-start" onClick={() => form.setValue('accentColor', DEFAULT_ACCENT_COLOR, { shouldDirty: true, shouldValidate: true })}>
          {t('settings.colourReset')}
        </Button>
      </Section>

      <Section id="languages" title={t('settings.languagesTitle')} intro={t('settings.languagesIntro')}>
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">{t('settings.languagesTitle')}</legend>
          {LOCALES.map((locale) => (
            <Checkbox
              key={locale}
              id={`locale-${locale}`}
              label={tc(`language.${locale}`)}
              description={locale === DEFAULT_LOCALE ? t('settings.languageAlwaysOn') : undefined}
              checked={locales.includes(locale)}
              disabled={locale === DEFAULT_LOCALE}
              onChange={(e) => toggleLocale(locale, e.target.checked)}
            />
          ))}
        </fieldset>
      </Section>

      <Section id="notifications" title={t('settings.notificationsTitle')}>
        <Checkbox
          id="email-notifications"
          label={t('settings.emailNotifications')}
          description={settings.smtpConfigured ? t('settings.smtpOn') : t('settings.smtpOff')}
          {...r('emailNotificationsEnabled')}
        />
      </Section>

      <Section id="welcome" title={t('settings.welcomeTitle')} intro={t('settings.welcomeIntro')}>
        <Checkbox id="welcome-enabled" label={t('settings.welcomeEnabled')} {...r('welcomeEnabled')} />
        <div className="flex flex-wrap items-center gap-4">
          {welcomeImage ? (
            <img src={mediaUrl(welcomeImage)} alt={t('settings.welcomeImage')} className="h-24 w-36 rounded-[var(--radius-art)] border border-border object-cover" />
          ) : (
            <p className="text-sm text-text-muted">{t('settings.welcomeNoImage')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <UploadButton
              label={welcomeImage ? t('settings.welcomeReplace') : t('settings.welcomeUpload')}
              accept="image/jpeg,image/png,image/webp"
              loading={uploadWelcome.isPending}
              describedBy="welcome-hint"
              onFiles={([file]) =>
                file &&
                uploadWelcome.mutate(file, {
                  onSuccess: ({ url }) => form.setValue('welcomeImageUrl', url, { shouldDirty: true }),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            />
            {welcomeImage ? (
              <Button variant="ghost" size="sm" onClick={() => form.setValue('welcomeImageUrl', '', { shouldDirty: true })}>
                {t('settings.welcomeRemove')}
              </Button>
            ) : null}
          </div>
        </div>
        <p id="welcome-hint" className="text-sm text-text-subtle">
          {t('settings.imageHint', { mb: MEDIA_MAX_FILE_SIZE_BYTES / MB })}
        </p>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-1 py-4 backdrop-blur">
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>
          {t('settings.save')}
        </Button>
        {isDirty ? <span className="text-sm text-text-muted">{t('settings.unsaved')}</span> : null}
      </div>
    </form>
  );
}
