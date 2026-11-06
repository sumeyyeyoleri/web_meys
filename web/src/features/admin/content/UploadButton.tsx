import { useId } from 'react';
import { buttonClasses, type ButtonVariant } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Spinner } from '../../../components/ui/Spinner';
import { cx } from '../../../components/ui/cx';

interface UploadButtonProps {
  label: string;
  accept: string;
  multiple?: boolean;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  describedBy?: string;
  onFiles: (files: File[]) => void;
}

/** A button that opens the file picker: the native input stays focusable (visually hidden). */
export function UploadButton({ label, accept, multiple, loading, disabled, variant = 'secondary', describedBy, onFiles }: UploadButtonProps) {
  const id = useId();
  return (
    <span className="inline-flex">
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled || loading}
        aria-describedby={describedBy}
        className="peer sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      <label
        htmlFor={id}
        aria-busy={loading || undefined}
        className={cx(
          buttonClasses(variant, 'sm'),
          'cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent',
        )}
      >
        {loading ? <Spinner size={16} /> : <Icon name="upload" size={18} />}
        {label}
      </label>
    </span>
  );
}
