import { useState } from 'react';
import { cx } from '../../components/ui/cx';
import { mediaUrl } from '../../lib/api';

interface ArtworkImageProps {
  src: string;
  alt: string;
  className?: string;
  /** `cover` crops to the frame (grids); `contain` shows the whole work (detail views). */
  fit?: 'cover' | 'contain';
  eager?: boolean;
}

/** Artwork with a quiet placeholder while loading; images keep a 4–6px radius. */
export function ArtworkImage({ src, alt, className, fit = 'cover', eager = false }: ArtworkImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={mediaUrl(src)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onLoad={() => setLoaded(true)}
      className={cx(
        'rounded-[var(--radius-art)] bg-surface-2 transition-opacity duration-500',
        fit === 'cover' ? 'object-cover' : 'object-contain',
        loaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  );
}
