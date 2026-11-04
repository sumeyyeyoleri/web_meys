import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingBlock } from '../components/ui/Spinner';
import { useMe } from '../features/auth/hooks';

/**
 * Client-side guard for the artist's pages (the API enforces the same rule). Visitors without
 * a session are sent to the admin login and come back afterwards.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <LoadingBlock className="min-h-[60vh]" />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}
