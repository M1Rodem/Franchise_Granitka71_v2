import type { CSSProperties } from 'react'

interface CompletionStatusInfo {
  label: string
  style: CSSProperties
}

export function getCompletionStatusInfo(
  status?: string | null
): CompletionStatusInfo {

  switch (status) {

    case 'Pending':
      return {
        label: 'Ожидает подтверждения',

        style: {
          background:
            'rgba(120, 119, 90, 0.16)',

          borderColor:
            'rgba(214, 190, 120, 0.18)',

          color:
            'rgba(255, 232, 170, 0.92)',
        },
      }

    case 'Approved':
      return {
        label: 'Выполнено',

        style: {
          background:
            'rgba(70, 120, 95, 0.18)',

          borderColor:
            'rgba(110, 190, 145, 0.20)',

          color:
            'rgba(190, 255, 220, 0.92)',
        },
      }

    case 'Rejected':
      return {
        label: 'Требуется доработка',

        style: {
          background:
            'rgba(120, 70, 70, 0.18)',

          borderColor:
            'rgba(210, 120, 120, 0.20)',

          color:
            'rgba(255, 210, 210, 0.92)',
        },
      }

    default:
      return {
        label: 'Неизвестно',

        style: {
          background:
            'rgba(90, 100, 120, 0.16)',

          borderColor:
            'rgba(150, 165, 190, 0.18)',

          color:
            'rgba(220, 228, 240, 0.92)',
        },
      }
  }
}