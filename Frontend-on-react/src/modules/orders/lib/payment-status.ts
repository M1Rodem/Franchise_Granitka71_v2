export const paymentStatusLabels: Record<number, string> = {
  0: '—',
  1: 'Аванс',
  2: 'Частично оплачен',
  3: 'Оплачен',
}

export function getPaymentBadgeStyle(status: string) {
  switch (status) {
    case 'Аванс':
      return {
        background: 'rgba(110,171,247,0.25)',
        border: '1px solid rgba(134,188,255,0.4)',
        color: '#dceeff',
      }

    case 'Оплачен':
      return {
        background: 'rgba(102,224,160,0.25)',
        border: '1px solid rgba(132,255,186,0.4)',
        color: '#dfffea',
      }

    case 'Частично оплачен':
      return {
        background: 'rgba(255,179,102,0.25)',
        border: '1px solid rgba(255,200,140,0.4)',
        color: '#fff1df',
      }

    default:
      return {
        background: 'rgba(134,188,255,0.15)',
        border: '1px solid rgba(134,188,255,0.25)',
        color: '#dceeff',
      }
  }
}