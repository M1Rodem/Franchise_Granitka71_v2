import { matchPath } from 'react-router-dom';
import type { NavigationItem } from '@/app/router/navigation.config';
import type { UserRole } from '@/shared/types/auth';

export const filterNavigationByRole = (
  items: NavigationItem[],
  role: UserRole | null | undefined,
): NavigationItem[] => {
  return items.filter((item) => {
    if (!item.roles || item.roles.length === 0) {
      return true;
    }

    return role ? item.roles.includes(role) : false;
  });
};

export const isNavigationItemActive = (pathname: string, item: NavigationItem): boolean => {
  return item.match.some((pattern) =>
    Boolean(matchPath({ path: pattern, end: !pattern.endsWith('/*') }, pathname)),
  );
};

export const resolveRouteTitle = (
  pathname: string,
  titleMap: Record<string, string>,
  fallback: string,
): string => {
  const sortedRoutes = Object.keys(titleMap).sort((a, b) => b.length - a.length);
  const matched = sortedRoutes.find((route) =>
    pathname === route || pathname.startsWith(`${route}/`),
  );

  return matched ? titleMap[matched] : fallback;
};
