import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { controlClasses } from './Field';
import { cx } from './cx';

/** Password field with a show/hide toggle (a 44px touch target inside the field). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function PasswordInput({ className, ...rest }, ref) {
    const { t } = useTranslation('account');
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input ref={ref} type={visible ? 'text' : 'password'} className={cx(controlClasses, 'pr-24', className)} {...rest} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t('fields.hidePassword') : t('fields.showPassword')}
          className="absolute top-1/2 right-1 inline-flex min-h-11 -translate-y-1/2 items-center rounded-[10px] px-3 text-sm font-semibold text-text-muted hover:text-text"
        >
          {visible ? t('fields.hidePassword') : t('fields.showPassword')}
        </button>
      </div>
    );
  },
);
