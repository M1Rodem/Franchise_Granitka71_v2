export interface PaymentStatusInfo {
  label: string
  style: React.CSSProperties
}

const PAYMENT_STATUS_MAP: Record<number, PaymentStatusInfo> = {
  0: {
    label: "—",
    style: {
      background: "rgba(134,188,255,0.15)",
      border: "1px solid rgba(134,188,255,0.25)",
      color: "#dceeff",
    },
  },

  1: {
    label: "Аванс",
    style: {
      background: "rgba(110,171,247,0.25)",
      border: "1px solid rgba(134,188,255,0.4)",
      color: "#dceeff",
    },
  },

  2: {
    label: "Частично оплачен",
    style: {
      background: "rgba(255,179,102,0.25)",
      border: "1px solid rgba(255,200,140,0.4)",
      color: "#fff1df",
    },
  },

  3: {
    label: "Оплачен",
    style: {
      background: "rgba(102,224,160,0.25)",
      border: "1px solid rgba(132,255,186,0.4)",
      color: "#dfffea",
    },
  },
}

export function getPaymentStatusInfo(status: number): PaymentStatusInfo {
  return (
    PAYMENT_STATUS_MAP[status] ?? PAYMENT_STATUS_MAP[0]
  )
}