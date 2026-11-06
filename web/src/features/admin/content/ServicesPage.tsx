import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DIMENSION_UNITS, LOCALES, serviceSchema, type AdminServiceDto } from '@painter/shared';
import type { z } from 'zod';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Icon } from '../../../components/ui/Icon';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Inputs';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { EmptyState, ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { isApiError, mediaUrl } from '../../../lib/api';
import { applyApiFieldErrors } from '../../../lib/form-errors';
import { useLocale } from '../../../lib/i18n';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminServices, useSaveService, useServiceActions } from '../hooks';
import { ImageField } from './ImageField';
import { MoveButtons } from './MoveButtons';

type Values = z.input<typeof serviceSchema>;
type Output = z.output<typeof serviceSchema>;

const empty = { name: '', description: '' };

function toValues(service: AdminServiceDto | null): Values {
  if (!service) {
    return { imageUrl: '', isActive: true, isWallService: false, defaultUnit: '', translations: { 'nl-BE': empty, en: empty, tr: empty } };
  }
  const tr = (l: (typeof LOCALES)[number]) => ({ name: service.translations[l].name, description: service.translations[l].description ?? '' });
  return {
    imageUrl: service.imageUrl ?? '',
    isActive: service.isActive,
    isWallService: service.isWallService,
    defaultUnit: service.defaultUnit ?? '',
    translations: { 'nl-BE': tr('nl-BE'), en: tr('en'), tr: tr('tr') },
  };
}

/** Services: add, edit (3 languages), order, switch on/off, delete unused ones (PROMPT.md §10). */
export function ServicesPage() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const services = useAdminServices();
  const actions = useServiceActions();
  const [editing, setEditing] = useState<AdminServiceDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminServiceDto | null>(null);
  const items = services.data ?? [];
  const nameOf = (s: AdminServiceDto) => s.translations[locale].name || s.translations['nl-BE'].name;

  return (
    <>
      <AdminPageHeader
        title={t('services.title')}
        intro={t('services.intro')}
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} />
            {t('services.add')}
          </Button>
        }
      />
      {services.isPending ? (
        <LoadingBlock />
      ) : services.isError ? (
        <ErrorState error={services.error} onRetry={() => void services.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="brush" title={t('services.empty')} />
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {items.map((service, index) => (
            <li key={service.id} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
              {service.imageUrl ? (
                <img src={mediaUrl(service.imageUrl)} alt="" className="size-16 shrink-0 rounded-[var(--radius-art)] object-cover" />
              ) : (
                <div className="size-16 shrink-0 rounded-[var(--radius-art)] border border-dashed border-border-strong" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="font-semibold">{nameOf(service)}</span>
                <span className="flex flex-wrap gap-2">
                  {service.isActive ? <Badge tone="green">{t('services.active')}</Badge> : <Badge>{t('services.inactive')}</Badge>}
                  {service.defaultUnit ? <Badge>{t('services.unitBadge', { unit: service.defaultUnit.toLowerCase() })}</Badge> : null}
                  {service.orderCount ? <span className="text-sm text-text-subtle">{t('services.orders', { count: service.orderCount })}</span> : null}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MoveButtons
                  name={nameOf(service)}
                  first={index === 0}
                  last={index === items.length - 1}
                  busy={actions.move.isPending}
                  onMove={(direction) => actions.move.mutate({ id: service.id, direction }, { onError: (e) => toast.error(errorMessage(e)) })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`${service.isActive ? t('services.deactivate') : t('services.activate')}: ${nameOf(service)}`}
                  onClick={() =>
                    actions.setActive.mutate(
                      { id: service.id, value: !service.isActive },
                      {
                        onSuccess: () => toast.success(service.isActive ? t('services.deactivated') : t('services.activated')),
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  <Icon name={service.isActive ? 'eyeOff' : 'eye'} size={18} />
                  {service.isActive ? t('services.deactivate') : t('services.activate')}
                </Button>
                <Button variant="secondary" size="sm" aria-label={`${tc('actions.edit')}: ${nameOf(service)}`} onClick={() => setEditing(service)}>
                  <Icon name="edit" size={18} />
                  {tc('actions.edit')}
                </Button>
                <Button variant="ghost" size="sm" aria-label={`${tc('actions.delete')}: ${nameOf(service)}`} onClick={() => setDeleting(service)}>
                  <Icon name="trash" size={18} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? <ServiceDialog service={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        destructive
        loading={actions.remove.isPending}
        title={t('services.deleteTitle')}
        description={deleting?.orderCount ? t('services.deleteInUse', { count: deleting.orderCount }) : t('services.deleteBody')}
        confirmLabel={deleting?.orderCount ? t('services.deactivate') : tc('actions.delete')}
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          // A service that orders use cannot be deleted: switch it off instead.
          if (target.orderCount) {
            actions.setActive.mutate({ id: target.id, value: false }, { onSettled: () => setDeleting(null), onSuccess: () => toast.success(t('services.deactivated')) });
            return;
          }
          actions.remove.mutate(target.id, {
            onSuccess: () => {
              setDeleting(null);
              toast.success(t('services.deleted'));
            },
            onError: (error) => {
              setDeleting(null);
              toast.error(isApiError(error, 'SERVICE_IN_USE') ? t('services.deleteInUseShort') : errorMessage(error));
            },
          });
        }}
      />
    </>
  );
}

function ServiceDialog({ service, onClose }: { service: AdminServiceDto | null; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const { t: to } = useTranslation('order');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveService(service?.id ?? null);
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(serviceSchema), defaultValues: toValues(service) });
  const { errors } = form.formState;
  const r = form.register;
  const imageUrl = form.watch('imageUrl') as string | undefined;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success(t('services.saved'));
      onClose();
    } catch (error) {
      const fields = LOCALES.flatMap((l) => [`translations.${l}.name`, `translations.${l}.description`] as const);
      if (!applyApiFieldErrors(error, form.setError, ['imageUrl', 'defaultUnit', ...fields])) toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open onClose={onClose} title={service ? t('services.editTitle') : t('services.addTitle')} className="max-w-3xl">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {save.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}
        {LOCALES.map((l) => (
          <fieldset key={l} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border p-4">
            <legend className="px-1 text-sm font-semibold">{tc(`language.${l}`)}</legend>
            <Field label={t('services.name')} error={errors.translations?.[l]?.name?.message} required>
              {(p) => <Input {...p} lang={l} {...r(`translations.${l}.name`)} />}
            </Field>
            <Field label={t('services.description')} error={errors.translations?.[l]?.description?.message} optional>
              {(p) => <Textarea {...p} lang={l} rows={3} {...r(`translations.${l}.description`)} />}
            </Field>
          </fieldset>
        ))}
        <ImageField
          label={t('services.image')}
          value={imageUrl ?? ''}
          removable
          error={errors.imageUrl?.message}
          onChange={(url) => form.setValue('imageUrl', url, { shouldDirty: true })}
        />
        <Field label={t('services.defaultUnit')} hint={t('services.defaultUnitHint')} error={errors.defaultUnit?.message} optional className="max-w-xs">
          {(p) => (
            <Select {...p} {...r('defaultUnit')}>
              <option value="">{t('services.noUnit')}</option>
              {DIMENSION_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {to(`form.unit${unit}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-1">
          <Checkbox id="service-active" label={t('services.activeLabel')} description={t('services.activeHint')} {...r('isActive')} />
          <Checkbox id="service-wall" label={t('services.wallLabel')} description={t('services.wallHint')} {...r('isWallService')} />
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('services.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
