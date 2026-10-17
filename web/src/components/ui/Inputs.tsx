import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { controlClasses } from './Field';
import { Icon } from './Icon';
import { cx } from './cx';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(controlClasses, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cx(controlClasses, 'min-h-28 resize-y leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cx(controlClasses, 'appearance-none pr-11', className)} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={18} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-text-muted" />
    </div>
  );
});

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

/** Native checkbox (styled with accent-color) with a large clickable label. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  return (
    <label htmlFor={id} className={cx('flex min-h-11 cursor-pointer items-start gap-3 py-1', className)}>
      <input ref={ref} id={id} type="checkbox" className="mt-1 size-5 shrink-0 cursor-pointer" {...rest} />
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] text-text">{label}</span>
        {description ? <span className="text-sm text-text-muted">{description}</span> : null}
      </span>
    </label>
  );
});

interface ChoiceCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'title'> {
  type?: 'radio' | 'checkbox';
  title: ReactNode;
  description?: ReactNode;
  media?: ReactNode;
}

/** Selectable card: selected = accent border + #121212 background; the native input stays visible. */
export const ChoiceCard = forwardRef<HTMLInputElement, ChoiceCardProps>(function ChoiceCard(
  { type = 'radio', title, description, media, className, id, ...rest },
  ref,
) {
  return (
    <label
      htmlFor={id}
      className={cx(
        'group flex cursor-pointer gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors duration-300 hover:border-border-strong has-[:checked]:border-accent has-[:checked]:bg-selected has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent',
        className,
      )}
    >
      <input ref={ref} id={id} type={type} className="mt-1 size-5 shrink-0 cursor-pointer focus-visible:outline-none" {...rest} />
      {media}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold text-text">{title}</span>
        {description ? <span className="text-sm text-text-muted">{description}</span> : null}
      </span>
    </label>
  );
});
