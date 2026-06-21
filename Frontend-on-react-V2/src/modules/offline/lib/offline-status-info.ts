export interface OfflineStatusInfo {
  label: string
  style: React.CSSProperties
}

const OFFLINE_STATUS_MAP: Record<
  string,
  OfflineStatusInfo
> = {
  pending: {
    label: 'Ожидает синхронизации',
    style: {
      background: 'rgba(255,179,102,0.25)',
      border:
        '1px solid rgba(255,200,140,0.4)',
      color: '#fff1df',
    },
  },

  syncing: {
    label: 'Синхронизация',
    style: {
      background: 'rgba(110,171,247,0.25)',
      border:
        '1px solid rgba(134,188,255,0.4)',
      color: '#dceeff',
    },
  },

  synced: {
    label: 'Успешно',
    style: {
      background: 'rgba(102,224,160,0.25)',
      border:
        '1px solid rgba(132,255,186,0.4)',
      color: '#dfffea',
    },
  },

  failed: {
    label: 'Ошибка',
    style: {
      background: 'rgba(255,92,92,0.25)',
      border:
        '1px solid rgba(255,120,120,0.4)',
      color: '#ffe0e0',
    },
  },
}

export function getOfflineStatusInfo(
  status: string
): OfflineStatusInfo {
  return (
    OFFLINE_STATUS_MAP[status] ??
    OFFLINE_STATUS_MAP.pending
  )
}