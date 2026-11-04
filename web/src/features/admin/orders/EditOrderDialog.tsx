import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { adminOrderUpdateSchema, DIMENSION_UNITS, LOCALES, localeToDb, type AdminOrderDetailDto } from '@painter/shared';
import type { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Input, Select, Textarea } from '../../../components/ui/Inputs';
import { useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { applyApiFieldErrors } from '../../../lib/form-errors';
import { useLocale } from '../../../lib/i18n';
import { useAdminServices, useUpdateOrder } from '../hooks';

type Values = z.input<typeof adminOrderUpdateSchema>;
const FIELDS = Object.keys(adminOrderUpdateSchema.shape) as Array<keyof Values>;

function initial(order: AdminOrderDetailDto): Values {
  return {
    serviceId: order.serviceId ?? '',
    title: order.title,
    width: String(order.width),
    height: String(order.height),
    unit: order.unit,
    description: order.description,
    fullName: order.contact.fullName,
    phone: order.contact.phone ?? '',
    email: order.contact.email ?? '',
    country: order.projectAddress.country,
    city: order.projectAddress.city,
    postalCode: order.projectAddress.postalCode,
    street: order.projectAddress.street,
    houseNumber: order.projectAddress.houseNumber,
    addressExtra: order.projectAddress.addressExtra ?? '',
    communicationLocale: order.contact.communicationLocale,
  };
}

/** Corrects the submitted data (typos, a missing house number …). Fields of older orders stay as submitted. */
export function EditOrderDialog({ order, open, onClose }: { order: AdminOrderDetailDto; open: boolean; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const { t: to } = useTranslation('order');
  const { t: tc } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const services = useAdminServices();
  const update = useUpdateOrder(order.id);
  const form = useForm<Values, unknown, z.output<typeof adminOrderUpdateSchema>>({
    resolver: zodResolver(adminOrderUpdateSchema),
    defaultValues: initial(order),
  });
  const { errors } = form.formState;
  const r = form.register;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success(t('edit.saved'));
      onClose();
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError, FIELDS)) toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onClose={onClose} title={t('edit.title')} description={t('edit.intro')} className="max-w-3xl">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {update.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(update.error)}</FormAlert> : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={to('form.service')} error={errors.serviceId?.message} optional>
            {(p) => (
              <Select {...p} {...r('serviceId')}>
                <option value="">{t('edit.noService')}</option>
                {services.data?.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.translations[locale]?.name || service.translations['nl-BE']?.name}
                    {service.isActive ? '' : ` (${t('edit.inactive')})`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('edit.orderTitle')} error={errors.title?.message} required>
            {(p) => <Input {...p} {...r('title')} />}
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label={to('form.width')} error={errors.width?.message} required>
            {(p) => <Input {...p} inputMode="decimal" autoComplete="off" {...r('width')} />}
          </Field>
          <Field label={to('form.height')} error={errors.height?.message} required>
            {(p) => <Input {...p} inputMode="decimal" autoComplete="off" {...r('height')} />}
          </Field>
          <Field label={to('form.unit')} error={errors.unit?.message} required>
            {(p) => (
              <Select {...p} {...r('unit')}>
                {DIMENSION_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {to(`form.unit${unit}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label={to('form.description')} error={errors.description?.message} required>
          {(p) => <Textarea {...p} rows={5} {...r('description')} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={to('form.fullName')} error={errors.fullName?.message} required>
            {(p) => <Input {...p} {...r('fullName')} />}
          </Field>
          <Field label={to('form.phone')} error={errors.phone?.message} required>
            {(p) => <Input {...p} type="tel" inputMode="tel" {...r('phone')} />}
          </Field>
          <Field label={to('form.email')} error={errors.email?.message} optional>
            {(p) => <Input {...p} type="email" inputMode="email" {...r('email')} />}
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={to('form.country')} error={errors.country?.message} required>
            {(p) => <Input {...p} {...r('country')} />}
          </Field>
          <Field label={to('form.city')} error={errors.city?.message} required>
            {(p) => <Input {...p} {...r('city')} />}
          </Field>
          <Field label={to('form.postalCode')} error={errors.postalCode?.message} required>
            {(p) => <Input {...p} {...r('postalCode')} />}
          </Field>
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-5">
          <Field label={to('form.street')} error={errors.street?.message} required>
            {(p) => <Input {...p} {...r('street')} />}
          </Field>
          <Field label={to('form.houseNumber')} error={errors.houseNumber?.message} required>
            {(p) => <Input {...p} {...r('houseNumber')} />}
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={to('form.addressExtra')} error={errors.addressExtra?.message} optional>
            {(p) => <Input {...p} {...r('addressExtra')} />}
          </Field>
          <Field label={t('edit.language')} error={errors.communicationLocale?.message} required>
            {(p) => (
              <Select {...p} {...r('communicationLocale')}>
                {LOCALES.map((l) => (
                  <option key={localeToDb(l)} value={l}>
                    {tc(`language.${l}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" loading={update.isPending}>
            {tc('actions.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
