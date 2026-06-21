import type { CSSProperties } from 'react'

interface OrderStatusInfo {
  label: string
  style: CSSProperties
}

export function getOrderStatusInfo(
  status?: number | null
): OrderStatusInfo {

  switch (status) {

    case 1:
      return {
        label: 'В работе',

        style: {
          background:
            'rgba(80, 110, 145, 0.16)',

          borderColor:
            'rgba(120, 170, 220, 0.18)',

          color:
            'rgba(210, 232, 255, 0.92)',
        },
      }

    case 5:
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

    case 6:
      return {
        label: 'Выполнен',

        style: {
          background:
            'rgba(70, 120, 95, 0.18)',

          borderColor:
            'rgba(110, 190, 145, 0.20)',

          color:
            'rgba(190, 255, 220, 0.92)',
        },
      }

    case 7:
      return {
        label: 'На доработке',

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