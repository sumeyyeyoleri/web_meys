import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DIMENSION_UNITS, LOCALES, MEDIA_MAX_FILE_SIZE_BYTES, portfolioItemSchema, type AdminCategoryDto, type AdminPortfolioItemDto } from '@painter/shared';
import type { z } from 'zod';
import { Badge, SampleBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Icon } from '../../../components/ui/Icon';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Inputs';
import { LoadingBlock } from '../../../components/ui/Spinner';
import { EmptyState, ErrorState, useErrorMessage } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/Toast';
import { mediaUrl } from '../../../lib/api';
import { applyApiFieldErrors } from '../../../lib/form-errors';
import { useLocale } from '../../../lib/i18n';
import { AdminPageHeader } from '../AdminPageHeader';
import { useAdminCategories, useAdminPortfolio, useBulkUpload, usePortfolioActions, useSavePortfolioItem } from '../hooks';
import { useCategoryName } from './CategoriesPage';
import { IMAGE_ACCEPT, ImageField } from './ImageField';
import { MoveButtons } from './MoveButtons';
import { UploadButton } from './UploadButton';

type Values = z.input<typeof portfolioItemSchema>;
type Output = z.output<typeof portfolioItemSchema>;

/** `?category=<id>`, `?category=none` (uncategorised) or everything. */
const NONE = 'none';

/** Catalog works: add, bulk upload into a category, edit, publish, feature, order, delete (PROMPT.md §10). */
export function CatalogAdminPage() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const portfolio = useAdminPortfolio();
  const categories = useAdminCategories();
  const actions = usePortfolioActions();
  const nameOf = useCategoryName();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<AdminPortfolioItemDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminPortfolioItemDto | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const filter = params.get('category') ?? '';
  const all = portfolio.data ?? [];
  const items = filter === NONE ? all.filter((i) => !i.categoryId) : filter ? all.filter((i) => i.categoryId === filter) : all;
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));
  const titleOf = (item: AdminPortfolioItemDto) => item.translations[locale].title || item.translations['nl-BE'].title;
  const onError = (error: unknown) => toast.error(errorMessage(error));

  return (
    <>
      <AdminPageHeader
        title={t('catalog.title')}
        intro={
          <>
            {t('catalog.intro')}{' '}
            <Link to="/admin/categories" className="underline underline-offset-4 hover:text-text">
              {t('catalog.toCategories')}
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
              <Icon name="upload" size={18} />
              {t('catalog.bulk')}
            </Button>
            <Button size="sm" onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} />
              {t('catalog.add')}
            </Button>
          </>
        }
      />

      <div className="mb-5 max-w-xs">
        <Field label={t('catalog.filter')}>
          {(p) => (
            <Select {...p} value={filter} onChange={(e) => setParams(e.target.value ? { category: e.target.value } : {}, { replace: true })}>
              <option value="">{t('catalog.allCategories')}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {nameOf(c)}
                </option>
              ))}
              <option value={NONE}>{t('catalog.uncategorised')}</option>
            </Select>
          )}
        </Field>
      </div>

      {portfolio.isPending ? (
        <LoadingBlock />
      ) : portfolio.isError ? (
        <ErrorState error={portfolio.error} onRetry={() => void portfolio.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="image" title={t('catalog.empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const index = all.indexOf(item);
            const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
                <img src={mediaUrl(item.imageUrl)} alt="" className="size-20 shrink-0 rounded-[var(--radius-art)] object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="font-semibold break-words">{titleOf(item)}</span>
                  <span className="text-sm text-text-subtle">{category ? nameOf(category) : t('catalog.uncategorised')}</span>
                  <span className="flex flex-wrap gap-2">
                    {item.isPublished ? <Badge tone="green">{t('catalog.published')}</Badge> : <Badge>{t('catalog.draft')}</Badge>}
                    {item.categoryHidden ? <Badge tone="amber">{t('catalog.categoryHidden')}</Badge> : null}
                    {item.isFeatured ? <Badge tone="accent">{t('catalog.featured')}</Badge> : null}
                    {item.isSample ? <SampleBadge /> : null}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MoveButtons
                    name={titleOf(item)}
                    first={index === 0}
                    last={index === all.length - 1}
                    busy={actions.move.isPending}
                    onMove={(direction) => actions.move.mutate({ id: item.id, direction }, { onError })}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`${item.isPublished ? t('catalog.unpublish') : t('catalog.publish')}: ${titleOf(item)}`}
                    onClick={() =>
                      actions.setPublished.mutate(
                        { id: item.id, value: !item.isPublished },
                        { onSuccess: () => toast.success(item.isPublished ? t('catalog.unpublished') : t('catalog.publishedToast')), onError },
                      )
                    }
                  >
                    <Icon name={item.isPublished ? 'eyeOff' : 'eye'} size={18} />
                    {item.isPublished ? t('catalog.unpublish') : t('catalog.publish')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-3"
                    aria-pressed={item.isFeatured}
                    aria-label={`${t('catalog.featureToggle')}: ${titleOf(item)}`}
                    onClick={() => actions.setFeatured.mutate({ id: item.id, value: !item.isFeatured }, { onError })}
                  >
                    <Icon name="star" size={18} className={item.isFeatured ? 'fill-current text-accent' : undefined} />
                  </Button>
                  <Button variant="secondary" size="sm" aria-label={`${tc('actions.edit')}: ${titleOf(item)}`} onClick={() => setEditing(item)}>
                    <Icon name="edit" size={18} />
                    {tc('actions.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`${tc('actions.delete')}: ${titleOf(item)}`} onClick={() => setDeleting(item)}>
                    <Icon name="trash" size={18} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <WorkDialog
          item={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          defaultCategoryId={filter && filter !== NONE ? filter : ''}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {bulkOpen ? <BulkUploadDialog categories={categories.data ?? []} defaultCategoryId={filter && filter !== NONE ? filter : ''} onClose={() => setBulkOpen(false)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        destructive
        loading={actions.remove.isPending}
        title={t('catalog.deleteTitle')}
        description={t('catalog.deleteBody')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() =>
          deleting &&
          actions.remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              toast.success(t('catalog.deleted'));
            },
            onError: (error) => {
              setDeleting(null);
              onError(error);
            },
          })
        }
      />
    </>
  );
}

function toValues(item: AdminPortfolioItemDto | null, defaultCategoryId: string): Values {
  const tr = (l: (typeof LOCALES)[number]) => ({ title: item?.translations[l].title ?? '', description: item?.translations[l].description ?? '' });
  return {
    imageUrl: item?.imageUrl ?? '',
    categoryId: item ? (item.categoryId ?? '') : defaultCategoryId,
    width: item?.width ?? '',
    height: item?.height ?? '',
    unit: item?.unit ?? '',
    year: item?.year ?? '',
    isFeatured: item?.isFeatured ?? false,
    isPublished: item?.isPublished ?? true,
    isSample: item?.isSample ?? false,
    allowSimilarRequest: item?.allowSimilarRequest ?? true,
    translations: { 'nl-BE': tr('nl-BE'), en: tr('en'), tr: tr('tr') },
  } as Values;
}

function WorkDialog({ item, categories, defaultCategoryId, onClose }: { item: AdminPortfolioItemDto | null; categories: AdminCategoryDto[]; defaultCategoryId: string; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { t: to } = useTranslation('order');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const nameOf = useCategoryName();
  const save = useSavePortfolioItem(item?.id ?? null);
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(portfolioItemSchema), defaultValues: toValues(item, defaultCategoryId) });
  const { errors } = form.formState;
  const r = form.register;
  const imageUrl = form.watch('imageUrl') as string | undefined;
  const categoryId = form.watch('categoryId') as string | undefined;
  const selectedHidden = categories.find((c) => c.id === categoryId)?.isVisible === false;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      toast.success(t('catalog.saved'));
      onClose();
    } catch (error) {
      const fields = LOCALES.flatMap((l) => [`translations.${l}.title`, `translations.${l}.description`] as const);
      if (!applyApiFieldErrors(error, form.setError, ['imageUrl', 'categoryId', 'width', 'height', 'unit', 'year', ...fields])) toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open onClose={onClose} title={item ? t('catalog.editTitle') : t('catalog.addTitle')} className="max-w-3xl">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {save.isError && !Object.keys(errors).length ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}
        <ImageField label={t('catalog.image')} value={imageUrl ?? ''} error={errors.imageUrl?.message} onChange={(url) => form.setValue('imageUrl', url, { shouldDirty: true, shouldValidate: true })} />
        <Field label={t('catalog.category')} hint={selectedHidden ? t('catalog.categoryHiddenHint') : undefined} error={errors.categoryId?.message}>
          {(p) => (
            <Select {...p} {...r('categoryId')}>
              <option value="">{t('catalog.uncategorised')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {nameOf(c)}
                  {c.isVisible ? '' : ` (${t('catalog.categoryHidden')})`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {LOCALES.map((l) => (
          <fieldset key={l} className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border p-4">
            <legend className="px-1 text-sm font-semibold">{tc(`language.${l}`)}</legend>
            <Field label={t('catalog.workTitle')} error={errors.translations?.[l]?.title?.message} required>
              {(p) => <Input {...p} lang={l} {...r(`translations.${l}.title`)} />}
            </Field>
            <Field label={t('catalog.description')} error={errors.translations?.[l]?.description?.message} optional>
              {(p) => <Textarea {...p} lang={l} rows={2} {...r(`translations.${l}.description`)} />}
            </Field>
          </fieldset>
        ))}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={to('form.width')} error={errors.width?.message} optional>
            {(p) => <Input {...p} inputMode="decimal" autoComplete="off" {...r('width')} />}
          </Field>
          <Field label={to('form.height')} error={errors.height?.message} optional>
            {(p) => <Input {...p} inputMode="decimal" autoComplete="off" {...r('height')} />}
          </Field>
          <Field label={to('form.unit')} error={errors.unit?.message} optional>
            {(p) => (
              <Select {...p} {...r('unit')}>
                <option value="">—</option>
                {DIMENSION_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {to(`form.unit${unit}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('catalog.year')} error={errors.year?.message} optional>
            {(p) => <Input {...p} inputMode="numeric" autoComplete="off" {...r('year')} />}
          </Field>
        </div>
        <div className="flex flex-col gap-1">
          <Checkbox id="work-published" label={t('catalog.publishedLabel')} description={t('catalog.publishedHint')} {...r('isPublished')} />
          <Checkbox id="work-featured" label={t('catalog.featuredLabel')} description={t('catalog.featuredHint')} {...r('isFeatured')} />
          <Checkbox id="work-similar" label={t('catalog.similarLabel')} description={t('catalog.similarHint')} {...r('allowSimilarRequest')} />
          <Checkbox id="work-sample" label={t('catalog.sampleLabel')} description={t('catalog.sampleHint')} {...r('isSample')} />
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('catalog.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Several photos into one category at once; each becomes a draft work to title and publish. */
function BulkUploadDialog({ categories, defaultCategoryId, onClose }: { categories: AdminCategoryDto[]; defaultCategoryId: string; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const nameOf = useCategoryName();
  const upload = useBulkUpload();
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<Array<{ name: string; error: unknown }>>([]);

  function start() {
    setDone(0);
    setFailed([]);
    upload.mutate(
      { files, categoryId: categoryId || null, onProgress: setDone },
      {
        onSuccess: (result) => {
          setFailed(result.failed);
          if (result.added) toast.success(t('catalog.bulkDone', { count: result.added }));
          if (!result.failed.length) onClose();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={upload.isPending ? () => undefined : onClose}
      title={t('catalog.bulkTitle')}
      description={t('catalog.bulkIntro')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={upload.isPending}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={start} loading={upload.isPending} disabled={!files.length}>
            {t('catalog.bulkStart', { count: files.length })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label={t('catalog.category')}>
          {(p) => (
            <Select {...p} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={upload.isPending}>
              <option value="">{t('catalog.uncategorised')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {nameOf(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <UploadButton
            label={t('catalog.bulkChoose')}
            accept={IMAGE_ACCEPT}
            multiple
            disabled={upload.isPending}
            describedBy="bulk-hint"
            onFiles={(chosen) => {
              setFiles(chosen);
              setFailed([]);
              setDone(0);
            }}
          />
          <p id="bulk-hint" className="text-sm text-text-subtle">
            {t('media.hint', { mb: MEDIA_MAX_FILE_SIZE_BYTES / (1024 * 1024) })}
          </p>
        </div>
        {files.length ? (
          <p className="text-sm" aria-live="polite">
            {upload.isPending || done ? t('catalog.bulkProgress', { done, total: files.length }) : t('catalog.bulkChosen', { count: files.length })}
          </p>
        ) : null}
        {failed.length ? (
          <FormAlert>
            <span className="flex flex-col gap-1">
              <span>{t('catalog.bulkFailed', { count: failed.length })}</span>
              {failed.map((f) => (
                <span key={f.name} className="text-sm">
                  {f.name}: {errorMessage(f.error)}
                </span>
              ))}
            </span>
          </FormAlert>
        ) : null}
      </div>
    </Dialog>
  );
}
