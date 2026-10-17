import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { cx } from './cx';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setToasts((items) => [...items.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label={t('toast.region')}
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {/* Polite live region: screen readers announce new messages without interrupting. */}
        <ol aria-live="polite" className="flex w-full flex-col gap-2 sm:w-96">
          {toasts.map((toast) => (
            <li
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={cx(
                'pointer-events-auto flex items-start gap-3 rounded-[var(--radius-card)] border bg-surface-2 py-3 pr-2 pl-4 shadow-2xl shadow-black/60',
                toast.tone === 'error' ? 'border-status-red/50' : toast.tone === 'success' ? 'border-status-green/50' : 'border-border',
              )}
            >
              <Icon
                name={toast.tone === 'error' ? 'alert' : toast.tone === 'success' ? 'check' : 'info'}
                className={cx(
                  'mt-0.5 shrink-0',
                  toast.tone === 'error' ? 'text-status-red' : toast.tone === 'success' ? 'text-status-green' : 'text-text-muted',
                )}
              />
              <p className="flex-1 py-0.5 text-sm text-text">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-text"
                aria-label={t('toast.dismiss')}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
