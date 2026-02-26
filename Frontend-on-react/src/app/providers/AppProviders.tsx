import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { queryClient } from '@/app/providers/query-client';
import { UNAUTHORIZED_EVENT } from '@/shared/api/http-client';
import { useAuthStore } from '@/shared/store/auth.store';

interface AppProvidersProps {
  children: React.ReactNode;
}

function UnauthorizedListener({ children }: AppProvidersProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => navigate('/login', { replace: true });

    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [navigate]);

  return <>{children}</>;
}

function SessionBootstrap({ children }: AppProvidersProps) {
  const hydrateSession = useAuthStore((state) => state.hydrateSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const sessionExpiresAt = useAuthStore((state) => state.sessionExpiresAt);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (!sessionExpiresAt) {
      return;
    }

    const timeout = window.setTimeout(
      () => clearSession(),
      Math.max(0, sessionExpiresAt - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [sessionExpiresAt, clearSession]);

  return <>{children}</>;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SessionBootstrap>
          <UnauthorizedListener>{children}</UnauthorizedListener>
        </SessionBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
