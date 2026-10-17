import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Warns before losing unsaved wizard data: the browser prompt on reload/close
 * (beforeunload) and an in-app confirmation for router navigation.
 * `allow()` disables the guard right before an intended navigation (after submitting).
 */
export function useLeaveGuard(dirty: boolean) {
  const allowedRef = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowedRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowedRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return {
    blocked: blocker.state === 'blocked',
    stay: () => blocker.state === 'blocked' && blocker.reset(),
    leave: () => blocker.state === 'blocked' && blocker.proceed(),
    allow: () => {
      allowedRef.current = true;
    },
  };
}
