import type { UserRole } from '@/shared/types/auth';

export const hasRequiredRole = (userRole: UserRole, requiredRoles: UserRole[]): boolean => {
  return requiredRoles.includes(userRole);
};
