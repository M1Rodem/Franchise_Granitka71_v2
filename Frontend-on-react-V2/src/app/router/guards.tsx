import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/shared/store/auth.store';
import { hasRequiredRole } from '@/shared/lib/roles';
import type { UserRole } from '@/shared/types/auth';

interface RequireAuthProps {
  children?: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const location = useLocation();

  if (!isHydrated) {
    return <div className="screen-loader">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

interface RequireRoleProps {
  roles: UserRole[];
  children?: React.ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const user = useAuthStore((state) => state.user);

  if (!user || !hasRequiredRole(user.role, roles)) {
    return <Navigate to="/orders" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
