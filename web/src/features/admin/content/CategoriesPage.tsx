import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { categorySchema, LOCALES, type AdminCategoryDto } from '@painter/shared';
import type { z } from 'zod';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Icon } from '../../../components/ui/Icon';
import { ChoiceCard, Input, Select } from '../../../components/ui/Inputs';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { EmptyState, ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { applyApiFieldErrors } from '../../../lib/form-errors';
import { useLocale } from '../../../lib/i18n';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminCategories, useCategoryActions, useSaveCategory } from '../hooks';
import { MoveButtons } from './MoveButtons';

type Values = z.input<typeof categorySchema>;
type Output = z.output<typeof categorySchema>;

/** The category's name in the dashboard language (Dutch as fallback). */
export function useCategoryName() {
  const locale = useLocale();
  return (category: AdminCategoryDto) => category.translations[locale].name || category.translations['nl-BE'].name;
}

/** Catalog categories: add, rename (NL/EN/TR), order, hide/show with their works, delete without losing works. */
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
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{nameOf(category)}</span>
                  {category.isVisible ? null : <Badge tone="amber">{t('categories.hiddenBadge')}</Badge>}
                </span>
                <span className="text-sm text-text-subtle">
                  {t('categories.works', { count: category.itemCount })}
                  {category.isVisible && category.itemCount === 0 ? ` · ${t('categories.notOnSite')}` : ''}
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
  const name = (l: (typeof LOCALES)[number]) => ({ name: category?.translations[l].name ?? '' });
  return { translations: { 'nl-BE': name('nl-BE'), en: name('en'), tr: name('tr') }, isVisible: category?.isVisible ?? true };
}

function CategoryDialog({ category, onClose }: { category: AdminCategoryDto | null; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const save = useSaveCategory(category?.id ?? null);
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(categorySchema), defaultValues: toValues(category) });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success(t('categories.saved'));
      onClose();
    } catch (error) {
      const fields = LOCALES.map((l) => `translations.${l}.name` as const);
      if (!applyApiFieldErrors(error, form.setError, fields)) toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open onClose={onClose} title={category ? t('categories.editTitle') : t('categories.addTitle')} description={t('categories.namesHint')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {save.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}
        {LOCALES.map((l) => (
          <Field key={l} label={t('categories.nameIn', { language: tc(`language.${l}`) })} error={errors.translations?.[l]?.name?.message} required>
            {(p) => <Input {...p} lang={l} maxLength={60} {...form.register(`translations.${l}.name`)} />}
          </Field>
        ))}
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
