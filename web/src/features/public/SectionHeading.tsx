import type { ReactNode } from 'react';
import { cx } from '../../components/ui/cx';
import { useReveal } from './useReveal';

export function SectionHeading({
  eyebrow,
  title,
  id,
  align = 'left',
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  id?: string;
  align?: 'left' | 'center';
  children?: ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cx('reveal flex flex-col gap-3', align === 'center' && 'items-center text-center')}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className="text-4xl sm:text-5xl">
        {title}
      </h2>
      {children ? <div className="max-w-2xl text-lg text-text-muted">{children}</div> : null}
    </div>
  );
}
