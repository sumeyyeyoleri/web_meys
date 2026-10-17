import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ToastProvider } from '../components/ui/Toast';
import { useSite } from '../features/public/hooks';
import { applyAccent } from '../lib/accent';
import { isApiError } from '../lib/api';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Client errors (4xx) are final; only retry network/server errors.
        retry: (failureCount, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

/** Applies the admin's accent colour (with an accessible text colour) to the whole app. */
function SiteThemeSync() {
  const { data: site } = useSite();
  useEffect(() => {
    applyAccent(site?.settings.accentColor);
  }, [site?.settings.accentColor]);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SiteThemeSync />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
