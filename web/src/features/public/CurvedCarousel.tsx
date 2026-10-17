import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PortfolioItemDto } from '@painter/shared';
import { IconButton } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { cx } from '../../components/ui/cx';
import { useMediaQuery, useReducedMotion } from '../../lib/use-media-query';
import { ArtworkImage } from './ArtworkImage';

interface CurvedCarouselProps {
  items: PortfolioItemDto[];
  index: number;
  onIndexChange: (index: number) => void;
}

const SWIPE_THRESHOLD_PX = 40;

/**
 * Featured works on a concave arc, like standing inside a round gallery (FRONTEND_DESIGN.md §4).
 * Wraps around; no autoplay; ←/→ when focused, swipe on touch, click a side card to center it.
 */
export function CurvedCarousel({ items, index, onIndexChange }: CurvedCarouselProps) {
  const { t } = useTranslation('public');
  const narrow = useMediaQuery('(max-width: 767px)');
  const reducedMotion = useReducedMotion();
  const pointerStart = useRef<number | null>(null);

  const total = items.length;
  const reach = narrow ? 1 : 3;
  const angle = narrow ? 12 : 22;
  const baseHeight = narrow ? 250 : 300;
  const go = (delta: number) => onIndexChange((index + delta + total) % total);

  /** Shortest signed distance from the centred item, wrapping around the ends. */
  const offsetOf = (i: number) => {
    let offset = i - index;
    if (offset > total / 2) offset -= total;
    if (offset <= -total / 2) offset += total;
    return offset;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) > SWIPE_THRESHOLD_PX) go(delta < 0 ? 1 : -1);
  };

  const current = items[index];
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div>
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t('carousel.label')}
        aria-describedby="carousel-hint"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => (pointerStart.current = event.clientX)}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pointerStart.current = null)}
        className="relative w-full touch-pan-y overflow-hidden rounded-none focus-visible:outline-offset-[-2px]"
        style={{ height: baseHeight + reach * 34 + 48 }}
      >
        <p id="carousel-hint" className="sr-only">
          {t('carousel.keyboardHint')}
        </p>
        {items.map((item, i) => {
          const offset = offsetOf(i);
          const distance = Math.abs(offset);
          const visible = distance <= reach;
          const centered = offset === 0;
          const style = {
            width: narrow ? 'min(52vw, 240px)' : '210px',
            height: baseHeight + distance * 34,
            transform: `translate(calc(-50% + ${offset} * (100% + 16px)), -50%) perspective(1100px) rotateY(${-offset * angle}deg)`,
            opacity: visible ? (distance === reach && reach > 0 ? 0.55 : 1) : 0,
            zIndex: 10 - distance,
            transition: reducedMotion
              ? 'none'
              : 'transform 500ms var(--ease-gallery), height 500ms var(--ease-gallery), opacity 400ms var(--ease-gallery)',
          };
          const label = t('carousel.slide', { index: i + 1, total, title: item.title });
          return (
            <div
              key={item.id}
              role="group"
              aria-roledescription="slide"
              aria-label={label}
              aria-hidden={!visible || undefined}
              inert={!visible || undefined}
              className={cx('absolute top-1/2 left-1/2', !visible && 'pointer-events-none')}
              style={style}
            >
              {centered ? (
                <div className="size-full overflow-hidden rounded-[var(--radius-art)] ring-1 ring-border-strong">
                  <ArtworkImage src={item.imageUrl} alt={item.title} className="size-full" eager />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={t('carousel.select', { title: item.title })}
                  className="block size-full overflow-hidden rounded-[var(--radius-art)] transition-[filter] duration-300 hover:brightness-110"
                >
                  <ArtworkImage src={item.imageUrl} alt="" className="size-full" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-5">
        <IconButton label={t('carousel.previous')} onClick={() => go(-1)} className="border border-border-strong">
          <Icon name="arrowLeft" />
        </IconButton>
        <p className="min-w-20 text-center font-sans text-sm tracking-[0.12em] text-text-muted tabular-nums" aria-hidden="true">
          {pad(index + 1)} / {pad(total)}
        </p>
        <IconButton label={t('carousel.next')} onClick={() => go(1)} className="border border-border-strong">
          <Icon name="arrowRight" />
        </IconButton>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {current ? `${t('carousel.counter', { current: index + 1, total })}: ${current.title}` : ''}
      </p>
    </div>
  );
}
