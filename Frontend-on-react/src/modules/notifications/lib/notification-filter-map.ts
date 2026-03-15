import type { NotificationFilter } from '../types/notification-filter'

export type NotificationStatusFilter =
  | 'pending'
  | 'postponed'
  | 'approved'
  | 'rejected'
  | 'all'

export const notificationFilterMap: Record<
  NotificationFilter,
  NotificationStatusFilter
> = {
  active: 'pending',
  postponed: 'postponed',
  history: 'all'
}