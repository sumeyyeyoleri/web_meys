import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UPLOAD_ALLOWED_EXTENSIONS, UPLOAD_ALLOWED_MIME_TYPES, UPLOAD_MAX_FILES, validateUploadCandidate } from '@painter/shared';
import { buttonClasses } from '../../components/ui/Button';
import { FieldError } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { useValidationMessage, VALIDATION_PARAMS } from '../../lib/i18n';
import type { OrderFile } from './order-form';

const ACCEPT = [...UPLOAD_ALLOWED_MIME_TYPES, ...UPLOAD_ALLOWED_EXTENSIONS].join(',');

interface PhotoPickerProps {
  files: OrderFile[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** Messages from the server (`files` or `files.<index>` → key). */
  serverErrors: Record<string, string>;
}

/** "Choose files or drag and drop": up to 8 JPG/PNG/WebP images with previews and remove buttons. */
export function PhotoPicker({ files, onAdd, onRemove, serverErrors }: PhotoPickerProps) {
  const { t } = useTranslation('order');
  const { t: tc } = useTranslation();
  const translate = useValidationMessage();
  const [rejections, setRejections] = useState<Array<{ name: string; reason: string }>>([]);
  const [dragging, setDragging] = useState(false);
  const remaining = UPLOAD_MAX_FILES - files.length;

  /** Checks type and size on the client (the server checks again, incl. file signatures). */
  function addFiles(list: FileList | File[]) {
    const rejected: Array<{ name: string; reason: string }> = [];
    const accepted: File[] = [];
    for (const file of [...list]) {
      const problem = validateUploadCandidate(file);
      if (problem) rejected.push({ name: file.name, reason: translate(problem) ?? '' });
      else accepted.push(file);
    }
    const fitting = accepted.slice(0, Math.max(0, remaining));
    const skipped = accepted.length - fitting.length;
    if (skipped > 0) rejected.push({ name: '', reason: t('photos.tooMany', { remaining: Math.max(0, remaining), skipped }) });
    setRejections(rejected);
    if (fitting.length) onAdd(fitting);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (remaining > 0) addFiles(event.dataTransfer.files);
  }

  const generalError = serverErrors.files;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-accent bg-selected' : 'border-border-strong bg-surface',
        )}
      >
        <Icon name="upload" size={28} className="text-text-muted" />
        {/* Native file input (focusable, visually hidden) named by the visible label below. */}
        <input
          id="order-photos"
          type="file"
          multiple
          accept={ACCEPT}
          className="peer sr-only"
          aria-describedby="order-photos-limits"
          disabled={remaining <= 0}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <label
          htmlFor="order-photos"
          className={cx(
            buttonClasses('secondary'),
            'cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent',
          )}
        >
          {t('photos.choose')}
        </label>
        <p className="hidden text-text-muted sm:block">{t('photos.drop')}</p>
        <p id="order-photos-limits" className="text-sm text-text-subtle">
          {t('photos.limits', VALIDATION_PARAMS)}
        </p>
      </div>

      <div aria-live="assertive">
        {rejections.length || generalError ? (
          <ul className="flex flex-col gap-1">
            {generalError ? (
              <li>
                <FieldError>{translate(generalError)}</FieldError>
              </li>
            ) : null}
            {rejections.map((r, i) => (
              <li key={i}>
                <FieldError>{r.name ? t('photos.rejected', { name: r.name, reason: r.reason }) : r.reason}</FieldError>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-sm text-text-muted" aria-live="polite">
        {t('photos.count', { count: files.length, max: UPLOAD_MAX_FILES })}
      </p>

      {files.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {files.map((item, index) => {
            const error = serverErrors[`files.${index}`];
            return (
              <li key={item.id} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-2">
                <img src={item.previewUrl} alt={item.file.name} className="aspect-square w-full rounded-[var(--radius-art)] object-cover" />
                <p className="truncate text-sm" title={item.file.name}>
                  {item.file.name}
                </p>
                {error ? <FieldError>{translate(error)}</FieldError> : null}
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={t('photos.remove', { name: item.file.name })}
                  className="inline-flex min-h-11 items-center self-start rounded-full px-3 text-sm font-semibold text-text-muted hover:text-status-red"
                >
                  {tc('actions.remove')}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
