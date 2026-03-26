import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/modules/auth/api/auth.api';
import { useAuthStore } from '@/shared/store/auth.store';
import { clearMediaCache } from '@/shared/lib/media/utils/media-loader'

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();

  return useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout request errors, local cleanup is mandatory.
    } finally {
      clearMediaCache()
      clearSession();
      navigate('/login', { replace: true });
    }
  }, [clearSession, navigate, clearMediaCache]);
}
