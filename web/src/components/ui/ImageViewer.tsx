import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClasses, IconButton } from './Button';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export interface ViewerImage {
  src: string;
  alt: string;
  /** Offers a download button (e.g. `?download=1`). */
  downloadHref?: string;
}

/** Full-screen image viewer: ←/→ browse, Esc closes, focus is trapped by the modal dialog. */
export function ImageViewer({ images, index, onIndexChange }: { images: ViewerImage[]; index: number | null; onIndexChange: (index: number | null) => void }) {
  const { t } = useTranslation('public');
  const { t: tc } = useTranslation();
  const image = index === null ? undefined : images[index];
  const total = images.length;
  const go = (delta: number) => index !== null && onIndexChange((index + delta + total) % total);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  };

  return (
    <Dialog open={image !== undefined} onClose={() => onIndexChange(null)} title={image?.alt ?? ''} variant="sheet">
      {image ? (
        <div onKeyDown={onKeyDown} className="flex min-h-[calc(100dvh-160px)] flex-col gap-4">
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-card)] bg-surface p-4">
            <img key={image.src} src={image.src} alt={image.alt} className="max-h-[70vh] max-w-full object-contain" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            {total > 1 ? (
              <>
                <IconButton label={t('lightbox.previous')} onClick={() => go(-1)} className="border border-border-strong">
                  <Icon name="arrowLeft" />
                </IconButton>
                <p className="min-w-16 text-center text-sm text-text-muted tabular-nums" aria-live="polite">
                  {t('lightbox.position', { current: (index ?? 0) + 1, total })}
                </p>
                <IconButton label={t('lightbox.next')} onClick={() => go(1)} className="border border-border-strong">
                  <Icon name="arrowRight" />
                </IconButton>
              </>
            ) : null}
            {image.downloadHref ? (
              <a href={image.downloadHref} className={buttonClasses('secondary', 'sm', 'gap-2')}>
                <Icon name="download" size={18} />
                {tc('actions.download')}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
