import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from './Button';
import { Icon } from './Icon';
import { cx } from './cx';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** `sheet` = full-screen panel (mobile menu, lightbox). */
  variant?: 'modal' | 'sheet';
  className?: string;
  /** Visually hide the title (it still names the dialog). */
  hideTitle?: boolean;
}

/**
 * Native <dialog> opened with showModal(): the rest of the page becomes inert (focus stays
 * inside), Esc closes it, and focus returns to the element that opened it.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = 'modal', className, hideTitle }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const opener = document.activeElement as HTMLElement | null;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
        if (dialog.open) dialog.close();
        opener?.focus?.();
      };
    }
    return undefined;
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Click on the backdrop (the dialog element itself) closes a modal.
        if (variant === 'modal' && event.target === ref.current) onClose();
      }}
      className={cx(
        'bg-transparent p-0 text-text backdrop:backdrop-blur-[2px] open:flex',
        variant === 'modal'
          ? 'm-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-lg'
          : 'm-0 h-dvh max-h-none w-screen max-w-none',
      )}
    >
      {open ? (
        <div
          className={cx(
            'flex w-full flex-col overflow-y-auto border border-border bg-surface-2',
            variant === 'modal' ? 'rounded-[var(--radius-panel)] p-6 sm:p-8' : 'min-h-full bg-bg p-4 sm:p-8',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className={cx('text-3xl', hideTitle && 'sr-only')}>
              {title}
            </h2>
            <IconButton label={t('actions.close')} onClick={onClose} className="-mt-2 -mr-2 ml-auto">
              <Icon name="close" />
            </IconButton>
          </div>
          {description ? (
            <p id={descriptionId} className="mt-3 text-text-muted">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-8 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
}

/** Confirmation for destructive or irreversible actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, destructive, loading }: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
