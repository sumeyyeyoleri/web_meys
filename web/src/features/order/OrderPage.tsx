import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm, type Path, type Resolver } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DIMENSION_UNITS, ORDER_FORM_FIELDS, orderFormSchema } from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog';
import { Field, FieldError } from '../../components/ui/Field';
import { FormAlert } from '../../components/ui/FormAlert';
import { Icon } from '../../components/ui/Icon';
import { Checkbox, ChoiceCard, Input, Select, Textarea } from '../../components/ui/Inputs';
import { Skeleton } from '../../components/ui/Spinner';
import { useErrorMessage } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { isApiError } from '../../lib/api';
import { useLocale, useValidationMessage, VALIDATION_PARAMS } from '../../lib/i18n';
import { usePageTitle } from '../../lib/use-page-title';
import { useMe } from '../auth/hooks';
import { LoginForm } from '../auth/LoginForm';
import { ArtworkImage } from '../public/ArtworkImage';
import { usePortfolioItem, useServices } from '../public/hooks';
import { InspirationBanner } from './InspirationBanner';
import { initialValues, newIdempotencyKey, profileValues, splitServerErrors, type OrderFile, type OrderFormValues } from './order-form';
import { PhotoPicker } from './PhotoPicker';
import { matchServiceForCategory } from './service-match';
import { useLeaveGuard } from './useLeaveGuard';
import { useSubmitOrder, type GuestConfirmationState } from './useSubmitOrder';

const decimal = { type: 'text', inputMode: 'decimal' as const, autoComplete: 'off' };

type OrderFormOutput = z.output<typeof orderFormSchema>;

/** Single-page order form (PROMPT.md §6): guests and signed-in customers, no account required. */
export function OrderPage() {
  const { t } = useTranslation('order');
  const { t: tc } = useTranslation();
  usePageTitle(t('meta.title'));
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const translate = useValidationMessage();
  const locale = useLocale();
  const [params] = useSearchParams();
  const { data: user } = useMe();
  const services = useServices();
  const submit = useSubmitOrder();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [defaultCountry] = useState(() => t('form.defaultCountry'));
  const form = useForm<OrderFormValues, unknown, OrderFormOutput>({
    // The checkbox starts unchecked (`false`); the schema only accepts `true`.
    resolver: zodResolver(orderFormSchema) as Resolver<OrderFormValues, unknown, OrderFormOutput>,
    defaultValues: initialValues(defaultCountry),
    // Focus is moved to the first invalid field in the order the fields appear (see `focusFirstError`).
    shouldFocusError: false,
  });
  const { errors, isDirty } = form.formState;
  const r = form.register;
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [loginOpen, setLoginOpen] = useState(false);
  const guard = useLeaveGuard((isDirty || files.length > 0) && !submit.isSuccess);
  const isAdmin = user?.role === 'ADMIN';

  // Catalog example (`?from=<id>`), attached as a reference until removed.
  const fromId = params.get('from');
  const [inspirationId, setInspirationId] = useState<string | null>(fromId);
  const inspirationQuery = usePortfolioItem(inspirationId);
  const inspiration = inspirationQuery.data?.allowSimilarRequest ? inspirationQuery.data : null;
  const inspirationUnavailable = !!fromId && (inspirationQuery.isError || inspirationQuery.data?.allowSimilarRequest === false);
  const [matchedServiceId, setMatchedServiceId] = useState<string | null>(null);

  // Preselect a service once: `?service=<id>`, else the one matching the catalog example.
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current || !services.data || (inspirationId && inspirationQuery.isPending)) return;
    preselected.current = true;
    const requested = services.data.find((s) => s.id === params.get('service'))?.id;
    const matched = inspiration
      ? matchServiceForCategory(services.data, inspiration.category, tc(`category.${inspiration.category}`))?.id
      : undefined;
    const serviceId = requested ?? matched;
    if (serviceId) form.setValue('serviceId', serviceId);
    if (!requested && matched) setMatchedServiceId(matched);
  }, [services.data, inspiration, inspirationId, inspirationQuery.isPending, params, form, tc]);

  // Signed-in customers: fill empty contact fields from the profile (typed values win).
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user || user.role === 'ADMIN' || prefilledFor.current === user.id) return;
    prefilledFor.current = user.id;
    for (const [name, value] of Object.entries(profileValues(user)) as Array<[keyof OrderFormValues, string]>) {
      const current = form.getValues(name);
      const untouched = typeof current !== 'string' || !current.trim() || (name === 'country' && current === defaultCountry);
      if (untouched) form.setValue(name, value);
    }
  }, [user, form, defaultCountry]);

  // Object URLs are released when files are removed (below) and when the page closes.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl)), []);

  const selectedServiceId = form.watch('serviceId');

  function removeInspiration() {
    setInspirationId(null);
    setMatchedServiceId(null);
  }

  const onSubmit = form.handleSubmit((values) => {
    if (submit.isPending) return;
    setFileErrors({});
    const data = {
      ...values,
      idempotencyKey,
      inspirationItemId: inspiration?.id ?? '',
      // Not asked: the language the customer is using the site in.
      communicationLocale: locale,
    };
    submit.mutate(
      { data, files },
      {
        onSuccess: (result) => {
          guard.allow();
          if (result.tracking) {
            const state: GuestConfirmationState = {
              reference: result.order.reference,
              tracking: result.tracking,
              email: values.email,
              inspirationTitle: result.order.inspiration?.title ?? null,
            };
            navigate('/order/sent', { state });
          } else {
            navigate(`/order/confirmation/${result.order.id}`);
          }
        },
        onError: (error) => {
          if (isApiError(error) && Object.keys(error.fields).length) {
            const { formErrors, fileErrors: perFile, inspirationInvalid } = splitServerErrors(error.fields);
            formErrors.forEach(([name, key]) => form.setError(name as Path<OrderFormValues>, { type: 'server', message: key }));
            focusFirstError(formErrors.map(([name]) => name));
            setFileErrors(perFile);
            if (inspirationInvalid) {
              removeInspiration();
              toast.error(t('inspiration.unavailable'));
            } else if (Object.keys(perFile).length) {
              toast.error(t('errors.filesInvalid'));
              document.getElementById('photos-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            } else {
              toast.error(t('errors.checkFields'));
            }
            return;
          }
          if (isApiError(error, 'UPLOAD_TOO_MANY_FILES') || isApiError(error, 'UPLOAD_FILE_TOO_LARGE') || isApiError(error, 'UPLOAD_INVALID_TYPE')) {
            toast.error(t('errors.filesInvalid'));
            return;
          }
          toast.error(errorMessage(error));
        },
      },
    );
  }, (invalid) => {
    focusFirstError(Object.keys(invalid));
    toast.error(t('errors.checkFields'));
  });

  function focusFirstError(names: string[]) {
    const first = ORDER_FORM_FIELDS.find((name) => names.includes(name));
    if (first) form.setFocus(first);
  }

  const sectionTitle = 'font-sans text-lg font-semibold text-text';

  return (
    <div className="container-content pt-32 pb-24 sm:pt-40">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <Link to="/catalog" className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-text-muted hover:text-text">
            <Icon name="arrowLeft" size={18} />
            {t('header.backToCatalog')}
          </Link>
          <p className="eyebrow">{t('header.eyebrow')}</p>
          <h1 className="text-5xl sm:text-6xl">{t('header.title')}</h1>
          <p className="text-text-muted">{t('header.intro')}</p>
        </header>

        {inspirationUnavailable ? <FormAlert tone="info">{t('inspiration.unavailable')}</FormAlert> : null}
        {inspiration ? (
          <InspirationBanner item={inspiration} serviceMatched={!!matchedServiceId && selectedServiceId === matchedServiceId} onRemove={removeInspiration} />
        ) : null}
        {isAdmin ? <FormAlert>{t('form.adminNotAllowed')}</FormAlert> : null}
        {user && !isAdmin ? <FormAlert tone="info">{t('form.signedInAs', { email: user.email })}</FormAlert> : null}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-10" aria-busy={submit.isPending || undefined}>
          {/* 1. Service (optional) */}
          <fieldset className="flex flex-col gap-3">
            <legend className={`${sectionTitle} mb-3`}>
              {t('form.service')} <span className="font-normal text-text-subtle">({tc('labels.optional')})</span>
            </legend>
            {services.isError ? <p className="text-text-muted">{t('form.servicesError')}</p> : null}
            {services.isPending ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-[var(--radius-card)]" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {services.data?.map((service) => (
                  <ChoiceCard
                    key={service.id}
                    id={`service-${service.id}`}
                    value={service.id}
                    {...r('serviceId')}
                    title={service.name}
                    className="p-3"
                    media={service.imageUrl ? <ArtworkImage src={service.imageUrl} alt="" className="hidden size-10 shrink-0 sm:block" /> : undefined}
                  />
                ))}
              </div>
            )}
            {selectedServiceId ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => form.setValue('serviceId', '', { shouldDirty: true })}>
                {t('form.clearService')}
              </Button>
            ) : null}
          </fieldset>

          {/* 2. Size */}
          <fieldset className="flex flex-col gap-3">
            <legend className={`${sectionTitle} mb-3`}>{t('form.size')}</legend>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_auto_1fr_minmax(150px,auto)] sm:items-start">
              <Field label={t('form.width')} error={errors.width?.message} required>
                {(p) => <Input {...p} {...decimal} aria-describedby={describedBy(p['aria-describedby'])} {...r('width')} />}
              </Field>
              <span className="hidden pt-11 text-text-muted sm:block" aria-hidden="true">
                ×
              </span>
              <Field label={t('form.height')} error={errors.height?.message} required>
                {(p) => <Input {...p} {...decimal} aria-describedby={describedBy(p['aria-describedby'])} {...r('height')} />}
              </Field>
              <Field label={t('form.unit')} error={errors.unit?.message} required className="col-span-2 sm:col-span-1">
                {(p) => (
                  <Select {...p} {...r('unit')}>
                    {DIMENSION_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`form.unit${unit}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <p id="size-hint" className="text-sm text-text-muted">
              {t('form.sizeHint')}
            </p>
          </fieldset>

          {/* 3. Request / description */}
          <Field
            label={<span className={sectionTitle}>{t('form.description')}</span>}
            hint={t('form.descriptionHint', VALIDATION_PARAMS)}
            error={errors.description?.message}
            required
          >
            {(p) => <Textarea {...p} rows={7} placeholder={t('form.descriptionPlaceholder')} {...r('description')} />}
          </Field>

          {/* 4. Photos (optional) */}
          <section aria-labelledby="photos-title" className="flex flex-col gap-3">
            <h2 id="photos-title" className={sectionTitle}>
              {t('form.photos')} <span className="font-normal text-text-subtle">({tc('labels.optional')})</span>
            </h2>
            <PhotoPicker
              files={files}
              serverErrors={fileErrors}
              onAdd={(list) => {
                setFiles((current) => [...current, ...list.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))]);
                setFileErrors({});
              }}
              onRemove={(id) => {
                setFiles((current) => {
                  const found = current.find((f) => f.id === id);
                  if (found) URL.revokeObjectURL(found.previewUrl);
                  return current.filter((f) => f.id !== id);
                });
                setFileErrors({});
              }}
            />
          </section>

          {/* 5–7. Contact and address */}
          <section aria-labelledby="contact-title" className="flex flex-col gap-5">
            <h2 id="contact-title" className={sectionTitle}>
              {t('form.contact')}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('form.fullName')} error={errors.fullName?.message} required>
                {(p) => <Input {...p} autoComplete="name" {...r('fullName')} />}
              </Field>
              <Field label={t('form.email')} error={errors.email?.message} required>
                {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" {...r('email')} />}
              </Field>
            </div>
            <Field label={t('form.phone')} hint={t('form.phoneHint')} error={errors.phone?.message} optional className="sm:max-w-sm">
              {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" {...r('phone')} />}
            </Field>
          </section>

          <fieldset className="flex flex-col gap-5">
            <legend className={`${sectionTitle} mb-1`}>{t('form.address')}</legend>
            <p className="-mt-2 text-sm text-text-muted">{t('form.addressHint')}</p>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('form.country')} error={errors.country?.message} required>
                {(p) => <Input {...p} autoComplete="country-name" {...r('country')} />}
              </Field>
              <Field label={t('form.city')} error={errors.city?.message} required>
                {(p) => <Input {...p} autoComplete="address-level2" {...r('city')} />}
              </Field>
              <Field label={t('form.postalCode')} error={errors.postalCode?.message} required>
                {(p) => <Input {...p} autoComplete="postal-code" {...r('postalCode')} />}
              </Field>
            </div>
            <div className="grid grid-cols-[2fr_1fr] gap-5">
              <Field label={t('form.street')} error={errors.street?.message} required>
                {(p) => <Input {...p} autoComplete="address-line1" {...r('street')} />}
              </Field>
              <Field label={t('form.houseNumber')} error={errors.houseNumber?.message} required>
                {(p) => <Input {...p} {...r('houseNumber')} />}
              </Field>
            </div>
            <Field label={t('form.addressExtra')} error={errors.addressExtra?.message} optional>
              {(p) => <Input {...p} autoComplete="address-line2" {...r('addressExtra')} />}
            </Field>
          </fieldset>

          {/* 8. Privacy and submit */}
          <div className="flex flex-col gap-6 border-t border-border pt-8">
            <div className="flex flex-col gap-1">
              <Checkbox
                id="privacy-accepted"
                label={t('form.privacy')}
                aria-invalid={errors.privacyAccepted ? true : undefined}
                aria-describedby={errors.privacyAccepted ? 'privacy-error' : undefined}
                aria-required
                {...r('privacyAccepted')}
              />
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="ml-8 inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
                {t('form.privacyLink')}
                <span className="sr-only"> {tc('labels.opensInNewTab')}</span>
              </a>
              {errors.privacyAccepted?.message ? <FieldError id="privacy-error">{translate(errors.privacyAccepted.message)}</FieldError> : null}
            </div>
            <p className="text-sm text-text-muted">{t('form.noCharge')}</p>
            <Button type="submit" loading={submit.isPending} disabled={isAdmin} className="w-full sm:w-auto sm:self-start">
              {submit.isPending ? t('form.submitting') : t('form.submit')}
            </Button>
            {!user ? (
              <p className="text-sm text-text-muted">
                {t('form.haveAccount')}{' '}
                <button type="button" onClick={() => setLoginOpen(true)} className="inline-flex min-h-11 items-center font-semibold text-text underline underline-offset-4">
                  {t('form.login')}
                </button>
              </p>
            ) : null}
          </div>
        </form>
      </div>

      <Dialog open={loginOpen} onClose={() => setLoginOpen(false)} title={t('form.loginDialogTitle')} description={t('form.loginDialogIntro')}>
        <LoginForm defaultEmail={form.getValues('email')} onSuccess={() => setLoginOpen(false)} />
      </Dialog>

      <ConfirmDialog
        open={guard.blocked}
        onClose={guard.stay}
        onConfirm={guard.leave}
        title={t('leave.title')}
        description={t('leave.body')}
        confirmLabel={t('leave.leave')}
        destructive
      />
    </div>
  );
}

/** Adds the shared "Example: 30 × 40 cm" hint to a size field's description. */
function describedBy(own: string | undefined) {
  return [own, 'size-hint'].filter(Boolean).join(' ');
}
