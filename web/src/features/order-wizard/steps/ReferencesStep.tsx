import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UPLOAD_ALLOWED_EXTENSIONS, UPLOAD_ALLOWED_MIME_TYPES, UPLOAD_MAX_FILES, validateUploadCandidate, type PortfolioItemDto } from '@painter/shared';
import { Button, buttonClasses } from '../../../components/ui/Button';
import { FieldError } from '../../../components/ui/Field';
import { Icon } from '../../../components/ui/Icon';
import { cx } from '../../../components/ui/cx';
import { useValidationMessage, VALIDATION_PARAMS } from '../../../lib/i18n';
import { ArtworkImage } from '../../public/ArtworkImage';
import type { WizardFile } from '../wizard-model';
import { StepShell } from './StepShell';

const ACCEPT = [...UPLOAD_ALLOWED_MIME_TYPES, ...UPLOAD_ALLOWED_EXTENSIONS].join(',');

interface ReferencesStepProps {
  files: WizardFile[];
  onAdd: (files: File[]) => void;
  onReplace: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  inspiration: PortfolioItemDto | null;
  onRemoveInspiration: () => void;
  /** Per-file messages from the server (`files.<index>` → key). */
  serverErrors?: Record<string, string>;
  onNext: () => void;
  onBack: () => void;
}

export function ReferencesStep({ files, onAdd, onReplace, onRemove, inspiration, onRemoveInspiration, serverErrors, onNext, onBack }: ReferencesStepProps) {
  const { t } = useTranslation('order');
  const { t: tc } = useTranslation();
  const translate = useValidationMessage();
  const [rejections, setRejections] = useState<Array<{ name: string; reason: string }>>([]);
  const [dragging, setDragging] = useState(false);
  const remaining = UPLOAD_MAX_FILES - files.length;

  /** Validates type/size per file on the client (the server checks again, incl. file signatures). */
  function addFiles(list: FileList | File[]) {
    const incoming = [...list];
    const rejected: Array<{ name: string; reason: string }> = [];
    const accepted: File[] = [];
    for (const file of incoming) {
      const problem = validateUploadCandidate(file);
      if (problem) rejected.push({ name: file.name, reason: translate(problem) ?? '' });
      else accepted.push(file);
    }
    const fitting = accepted.slice(0, Math.max(0, remaining));
    const skipped = accepted.length - fitting.length;
    if (skipped > 0) {
      rejected.push({ name: '', reason: t('references.tooMany', { remaining: Math.max(0, remaining), skipped }) });
    }
    setRejections(rejected);
    if (fitting.length) onAdd(fitting);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  const fileError = (index: number) => serverErrors?.[`files.${index}`];

  return (
    <StepShell
      title={t('references.title')}
      intro={t('references.intro')}
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      onBack={onBack}
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-10 text-center transition-colors',
          dragging ? 'border-accent bg-selected' : 'border-border-strong bg-surface',
        )}
      >
        <Icon name="upload" size={28} className="text-text-muted" />
        <p className="hidden text-text-muted sm:block">{t('references.drop')}</p>
        {/* Native file input (focusable, visually hidden) named by the visible label below. */}
        <input
          id="reference-files"
          type="file"
          multiple
          accept={ACCEPT}
          className="peer sr-only"
          aria-describedby="reference-limits"
          disabled={remaining <= 0}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <label
          htmlFor="reference-files"
          className={cx(
            buttonClasses('secondary'),
            'cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent',
          )}
        >
          {t('references.chooseMobile')}
        </label>
        <p id="reference-limits" className="text-sm text-text-subtle">
          {t('references.limits', VALIDATION_PARAMS)}
        </p>
      </div>

      {rejections.length ? (
        <ul className="flex flex-col gap-1" aria-live="assertive">
          {rejections.map((r, i) => (
            <li key={i}>
              <FieldError>{r.name ? t('references.rejected', { name: r.name, reason: r.reason }) : r.reason}</FieldError>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted" aria-live="polite">
          {t('references.count', { count: files.length, max: UPLOAD_MAX_FILES })}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {inspiration ? (
          <li className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-accent/60 bg-selected p-2">
            <ArtworkImage src={inspiration.imageUrl} alt={inspiration.title} className="aspect-square w-full" />
            <p className="eyebrow text-accent">{t('inspiration.fromCatalog')}</p>
            <p className="truncate text-sm">{inspiration.title}</p>
            <p className="text-xs text-text-subtle">{t('inspiration.notCounted')}</p>
            <Button variant="ghost" size="sm" onClick={onRemoveInspiration} className="self-start text-sm">
              {t('inspiration.remove')}
            </Button>
          </li>
        ) : null}
        {files.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-2">
            <img src={item.previewUrl} alt={item.file.name} className="aspect-square w-full rounded-[var(--radius-art)] object-cover" />
            <p className="truncate text-sm" title={item.file.name}>
              {item.file.name}
            </p>
            {fileError(index) ? <FieldError>{translate(fileError(index))}</FieldError> : null}
            <div className="flex flex-wrap gap-1">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-semibold text-text-muted hover:text-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
                {t('references.replace')}
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  aria-label={t('references.replaceLabel', { name: item.file.name })}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    const problem = validateUploadCandidate(file);
                    if (problem) setRejections([{ name: file.name, reason: translate(problem) ?? '' }]);
                    else {
                      setRejections([]);
                      onReplace(item.id, file);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={t('references.remove', { name: item.file.name })}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-text-muted hover:text-status-red"
              >
                {tc('actions.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!files.length && !inspiration ? <p className="text-sm text-text-subtle">{t('references.empty')}</p> : null}
    </StepShell>
  );
}
