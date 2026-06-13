export const OFFLINE_DB_NAME = 'granitka71-offline-db'
export const OFFLINE_DB_VERSION = 4

export const OFFLINE_STORE_NAMES = {
  orders: 'orders',
  media: 'media',
  syncQueue: 'syncQueue',
  employees: 'employees',
  plots: 'plots',
} as const

export type OfflineStoreName =
  (typeof OFFLINE_STORE_NAMES)[keyof typeof OFFLINE_STORE_NAMES]