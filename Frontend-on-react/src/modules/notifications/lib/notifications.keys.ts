export const notificationsKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationsKeys.all, 'list'] as const,
  list: (filters: any) => [...notificationsKeys.lists(), filters] as const,
  details: () => [...notificationsKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationsKeys.details(), id] as const,
  count: () => [...notificationsKeys.all, 'count'] as const,
};