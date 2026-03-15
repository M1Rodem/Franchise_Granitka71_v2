export const notificationFilters = [
  'active',
  'postponed',
  'history'
] as const

export type NotificationFilter =
  (typeof notificationFilters)[number]

export interface NotificationFilterCounts {
  active: number
  postponed: number
  history: number
}