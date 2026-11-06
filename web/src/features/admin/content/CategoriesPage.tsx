import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { categorySchema, DIMENSION_UNITS, LOCALES, type AdminCategoryDto } from '@painter/shared';
import type { z } from 'zod';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Icon } from '../../../components/ui/Icon';
import { Checkbox, ChoiceCard, Input, Select, Textarea } from '../../../components/ui/Inputs';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { EmptyState, ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { mediaUrl } from '../../../lib/api';
import { applyApiFieldErrors } from '../../../lib/form-errors';
import { useLocale } from '../../../lib/i18n';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminCategories, useCategoryActions, useSaveCategory } from '../hooks';
import { ImageField } from './ImageField';
import { MoveButtons } from './MoveButtons';

type Values = z.input<typeof categorySchema>;
type Output = z.output<typeof categorySchema>;

/** The category's name in the dashboard language (Dutch as fallback). */
export function useCategoryName() {
  const locale = useLocale();
  return (category: AdminCategoryDto) => category.translations[locale].name || category.translations['nl-BE'].name;
}

/**
 * Categories — one list for the catalog filter, the services page and the order form: add, edit
 * (NL/EN/TR name and description, cover, unit, switches), order, hide/show with their works,
 * delete without losing works.
 */
export function CategoriesPage() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const categories = useAdminCategories();
  const actions = useCategoryActions();
  const nameOf = useCategoryName();
  const [editing, setEditing] = useState<AdminCategoryDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminCategoryDto | null>(null);
  const items = categories.data ?? [];

  return (
    <>
      <AdminPageHeader
        title={t('categories.title')}
        intro={
          <>
            {t('categories.intro')}{' '}
            <Link to="/admin/catalog" className="underline underline-offset-4 hover:text-text">
              {t('categories.toCatalog')}
            </Link>
          </>
        }
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} />
            {t('categories.add')}
          </Button>
        }
      />
      {categories.isPending ? (
        <LoadingBlock />
      ) : categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="tag" title={t('categories.empty')} />
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {items.map((category, index) => (
            <li key={category.id} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
              {category.coverImageUrl ? (
                <img src={mediaUrl(category.coverImageUrl)} alt="" className="size-16 shrink-0 rounded-[var(--radius-art)] object-cover" />
              ) : (
                <div className="size-16 shrink-0 rounded-[var(--radius-art)] border border-dashed border-border-strong" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{nameOf(category)}</span>
                  {category.isVisible ? null : <Badge tone="amber">{t('categories.hiddenBadge')}</Badge>}
                  {category.showInOrderForm ? <Badge tone="green">{t('categories.inFormBadge')}</Badge> : <Badge>{t('categories.notInFormBadge')}</Badge>}
                  {category.defaultUnit ? <Badge>{t('categories.unitBadge', { unit: category.defaultUnit.toLowerCase() })}</Badge> : null}
                </span>
                <span className="text-sm text-text-subtle">
                  {t('categories.works', { count: category.itemCount })}
                  {category.orderCount ? ` · ${t('categories.orders', { count: category.orderCount })}` : ''}
                  {category.isVisible && category.itemCount === 0 ? ` · ${t('categories.notInCatalog')}` : ''}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MoveButtons
                  name={nameOf(category)}
                  first={index === 0}
                  last={index === items.length - 1}
                  busy={actions.move.isPending}
                  onMove={(direction) => actions.move.mutate({ id: category.id, direction }, { onError: (e) => toast.error(errorMessage(e)) })}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`${category.isVisible ? t('categories.hide') : t('categories.show')}: ${nameOf(category)}`}
                  onClick={() =>
                    actions.setVisible.mutate(
                      { id: category.id, value: !category.isVisible },
                      {
                        onSuccess: () => toast.success(category.isVisible ? t('categories.hidden') : t('categories.shown')),
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  <Icon name={category.isVisible ? 'eyeOff' : 'eye'} size={18} />
                  {category.isVisible ? t('categories.hide') : t('categories.show')}
                </Button>
                <Button variant="secondary" size="sm" aria-label={`${tc('actions.edit')}: ${nameOf(category)}`} onClick={() => setEditing(category)}>
                  <Icon name="edit" size={18} />
                  {tc('actions.edit')}
                </Button>
                <Button variant="ghost" size="sm" aria-label={`${tc('actions.delete')}: ${nameOf(category)}`} onClick={() => setDeleting(category)}>
                  <Icon name="trash" size={18} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? <CategoryDialog category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      {deleting ? <DeleteCategoryDialog category={deleting} others={items.filter((c) => c.id !== deleting.id)} onClose={() => setDeleting(null)} /> : null}
    </>
  );
}

function toValues(category: AdminCategoryDto | null): Values {
  const tr = (l: (typeof LOCALES)[number]) => ({ name: category?.translations[l].name ?? '', description: category?.translations[l].description ?? '' });
  return {
    translations: { 'nl-BE': tr('nl-BE'), en: tr('en'), tr: tr('tr') },
    isVisible: category?.isVisible ?? true,
    showInOrderForm: category?.showInOrderForm ?? true,
    coverImageUrl: category?.coverImageUrl ?? '',
    defaultUnit: category?.defaultUnit ?? '',
  };
}

function CategoryDialog({ category, onClose }: { category: AdminCategoryDto | null; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { t: to } = useTranslation('order');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveCategory(category?.id ?? null);
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(categorySchema), defaultValues: toValues(category) });
  const { errors } = form.formState;
  const r = form.register;
  // A string in the form (the schema's preprocess widens the input type).
  const cover = form.watch('coverImageUrl') as string | undefined;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success(t('categories.saved'));
      onClose();
    } catch (error) {
      const fields = LOCALES.flatMap((l) => [`translations.${l}.name`, `translations.${l}.description`] as const);
      if (!applyApiFieldErrors(error, form.setError, ['coverImageUrl', 'defaultUnit', ...fields])) toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open onClose={onClose} title={category ? t('categories.editTitle') : t('categories.addTitle')} description={t('categories.namesHint')} className="max-w-3xl">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {save.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}
        {LOCALES.map((l) => (
          <fieldset key={l} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border p-4">
            <legend className="px-1 text-sm font-semibold">{tc(`language.${l}`)}</legend>
            <Field label={t('categories.name')} error={errors.translations?.[l]?.name?.message} required>
              {(p) => <Input {...p} lang={l} maxLength={60} {...r(`translations.${l}.name`)} />}
            </Field>
            <Field label={t('categories.description')} hint={t('categories.descriptionHint')} error={errors.translations?.[l]?.description?.message} optional>
              {(p) => <Textarea {...p} lang={l} rows={2} maxLength={600} {...r(`translations.${l}.description`)} />}
            </Field>
          </fieldset>
        ))}
        <ImageField
          label={t('categories.cover')}
          value={cover ?? ''}
          removable
          error={errors.coverImageUrl?.message}
          onChange={(url) => form.setValue('coverImageUrl', url, { shouldDirty: true })}
        />
        <Field label={t('categories.defaultUnit')} hint={t('categories.defaultUnitHint')} error={errors.defaultUnit?.message} optional className="max-w-xs">
          {(p) => (
            <Select {...p} {...r('defaultUnit')}>
              <option value="">{t('categories.noUnit')}</option>
              {DIMENSION_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {to(`form.unit${unit}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-1">
          <Checkbox id="category-visible" label={t('categories.showOnSite')} description={t('categories.showOnSiteHint')} {...r('isVisible')} />
          <Checkbox id="category-form" label={t('categories.showInForm')} description={t('categories.showInFormHint')} {...r('showInOrderForm')} />
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('categories.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Asks where the works go: another category, or uncategorised. Works are never deleted. */
function DeleteCategoryDialog({ category, others, onClose }: { category: AdminCategoryDto; others: AdminCategoryDto[]; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { remove } = useCategoryActions();
  const nameOf = useCategoryName();
  const hasWorks = category.itemCount > 0;
  const [target, setTarget] = useState<'move' | 'none'>(others.length ? 'move' : 'none');
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '');

  function confirm() {
    remove.mutate(
      { id: category.id, moveTo: hasWorks && target === 'move' ? moveTo : undefined },
      {
        onSuccess: () => {
          toast.success(t('categories.deleted'));
          onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('categories.deleteTitle', { name: nameOf(category) })}
      description={hasWorks ? t('categories.deleteWithWorks', { count: category.itemCount }) : t('categories.deleteEmpty')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="danger" onClick={confirm} loading={remove.isPending}>
            {t('categories.deleteConfirm')}
          </Button>
        </>
      }
    >
      {hasWorks ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold">{t('categories.worksGo')}</legend>
          {others.length ? (
            <ChoiceCard
              id="delete-move"
              name="delete-target"
              checked={target === 'move'}
              onChange={() => setTarget('move')}
              title={t('categories.moveWorks')}
              description={
                <Select aria-label={t('categories.moveTarget')} value={moveTo} onChange={(e) => (setMoveTo(e.target.value), setTarget('move'))} className="mt-2">
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nameOf(c)}
                    </option>
                  ))}
                </Select>
              }
            />
          ) : null}
          <ChoiceCard
            id="delete-none"
            name="delete-target"
            checked={target === 'none'}
            onChange={() => setTarget('none')}
            title={t('categories.leaveUncategorised')}
            description={t('categories.leaveUncategorisedHint')}
          />
        </fieldset>
      ) : null}
    </Dialog>
  );
}
