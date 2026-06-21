import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/shared/store/auth.store';
import { hasRequiredRole } from '@/shared/lib/roles';
import type { UserRole } from '@/shared/types/auth';
import { useConnectivity } from '@/modules/offline/hooks/use-connectivity';
import { offlineEmployeesService } from '@/modules/offline/services/offline-employees.service';

interface RequireAuthProps {
  children?: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const location = useLocation();
  const { isOnline } = useConnectivity();
  const [hasEmployees, setHasEmployees] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const has = await offlineEmployeesService.hasEmployees();
      setHasEmployees(has);
      setIsChecking(false);
    };
    check();
  }, []);

  if (!isHydrated || isChecking) {
    return <div className="screen-loader">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    // Если нет интернета и есть кеш сотрудников — идём на оффлайн-логин
    if (hasEmployees === true && !isOnline) {
      return <Navigate to="/offline-login" replace />;
    }
    // Если есть интернет или нет кеша — идём на обычный логин
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