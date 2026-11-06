import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MEDIA_MAX_FILE_SIZE_BYTES } from '@painter/shared';
import { Button } from '../../../components/ui/Button';
import { FieldError } from '../../../components/ui/Field';
import { useErrorMessage } from '../../../components/ui/States';
import { mediaUrl } from '../../../lib/api';
import { useValidationMessage } from '../../../lib/i18n';
import { useUploadMedia } from '../hooks';
import { UploadButton } from './UploadButton';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Image of a service or work: preview, upload (optimised on the server) and optional removal. */
export function ImageField({
  label,
  value,
  onChange,
  error,
  removable = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  error?: string;
  removable?: boolean;
}) {
  const { t } = useTranslation('admin');
  const translate = useValidationMessage();
  const errorMessage = useErrorMessage();
  const upload = useUploadMedia();
  const hintId = useId();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-semibold text-text">{label}</legend>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          <img src={mediaUrl(value)} alt="" className="h-24 w-24 rounded-[var(--radius-art)] border border-border object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-[var(--radius-art)] border border-dashed border-border-strong text-xs text-text-subtle">
            {t('media.noImage')}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <UploadButton
            label={value ? t('media.replace') : t('media.upload')}
            accept={IMAGE_ACCEPT}
            loading={upload.isPending}
            describedBy={hintId}
            onFiles={([file]) => file && upload.mutate(file, { onSuccess: ({ url }) => onChange(url) })}
          />
          {removable && value ? (
            <Button variant="ghost" size="sm" onClick={() => onChange('')}>
              {t('media.remove')}
            </Button>
          ) : null}
        </div>
      </div>
      <p id={hintId} className="text-sm text-text-subtle">
        {t('media.hint', { mb: MEDIA_MAX_FILE_SIZE_BYTES / (1024 * 1024) })}
      </p>
      {upload.isError ? <FieldError>{errorMessage(upload.error)}</FieldError> : null}
      {error ? <FieldError>{error.startsWith('validation.') ? translate(error) : error}</FieldError> : null}
    </fieldset>
  );
}
