import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@painter/shared';
import { LoadingBlock } from '../components/ui/Spinner';
import { useMe } from '../features/auth/hooks';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Client-side route guard (the API enforces the same rules). Guests are sent to the login
 * page and come back afterwards; users without the role see the 404 page.
 */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { data: user, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <LoadingBlock className="min-h-[60vh]" />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (role && user.role !== role) return <NotFoundPage />;
  return <>{children}</>;
}
