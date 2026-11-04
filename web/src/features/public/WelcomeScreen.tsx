import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { useReducedMotion } from '../../lib/use-media-query';
import { BrandMark } from '../layout/BrandMark';
import { usePortfolio, useSite } from './hooks';

/** sessionStorage flag: the welcome screen is shown once per browser session. */
export const WELCOME_SEEN_KEY = 'meysart.welcomeSeen';
const FADE_MS = 500;

function hasSeenWelcome(): boolean {
  try {
    return window.sessionStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberWelcomeSeen() {
  try {
    window.sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // Private mode / blocked storage: the screen may simply show again.
  }
}

/**
 * Full-screen welcome over the home page (PROMPT.md §18.2). The page itself is rendered
 * underneath, so visitors arriving on other pages and search engines never see this.
 */
export function WelcomeScreen() {
  const { t } = useTranslation('public');
  const { data: site } = useSite();
  const { data: featured } = usePortfolio({ featured: true });
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'open' | 'closing' | 'closed'>(() => (hasSeenWelcome() ? 'closed' : 'open'));
  const dialogRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);

  const visible = phase !== 'closed' && site?.settings.welcomeEnabled === true;

  const dismiss = useCallback(() => {
    rememberWelcomeSeen();
    if (reducedMotion) setPhase('closed');
    else setPhase((current) => (current === 'open' ? 'closing' : current));
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [reducedMotion]);

  useEffect(() => {
    if (phase !== 'closing') return;
    const timer = window.setTimeout(() => setPhase('closed'), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // While open: focus the main action, keep the page behind from scrolling, Esc/Enter dismiss.
  useEffect(() => {
    if (!visible || phase !== 'open') return;
    enterRef.current?.focus({ preventScroll: true });
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root.style.overflow = previousOverflow;
    };
  }, [visible, phase, dismiss]);

  /** Keeps Tab inside the two controls. */
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!visible || !site) return null;

  const background = site.settings.welcomeImageUrl ?? featured?.[0]?.imageUrl ?? null;
  const tagline = site.content['welcome.tagline'];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('welcome.label')}
      aria-describedby={tagline ? 'welcome-tagline' : undefined}
      onKeyDown={trapFocus}
      className={cx(
        'fixed inset-0 z-[80] flex flex-col overflow-hidden bg-bg transition-opacity duration-500 ease-[var(--ease-gallery)] motion-reduce:transition-none',
        'motion-safe:animate-[welcome-in_800ms_ease-out]',
        phase === 'closing' && 'pointer-events-none opacity-0',
      )}
    >
      {background ? (
        <img src={background} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      ) : null}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/40 to-bg/90" />

      <div className="safe-x safe-pt relative flex justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 inline-flex min-h-11 items-center px-3 text-sm font-medium text-text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
        >
          {t('welcome.skip')}
        </button>
      </div>

      <div className="safe-x safe-pb relative flex flex-1 flex-col items-center justify-center gap-8 pb-16 text-center">
        <p>
          <BrandMark className="text-[64px] sm:text-[104px]" logoClassName="h-24 w-auto max-w-[min(80vw,420px)] sm:h-32" />
        </p>
        {tagline ? (
          <p id="welcome-tagline" className="max-w-xl font-display text-2xl text-pretty text-text-muted italic sm:text-3xl">
            {tagline}
          </p>
        ) : null}
        <Button ref={enterRef} onClick={dismiss} className="mt-2">
          {t('welcome.enter')}
        </Button>
      </div>
    </div>
  );
}
