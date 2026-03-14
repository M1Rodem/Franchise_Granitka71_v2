export interface UserStatusInfo {
  label: string
  style: React.CSSProperties
}

export function getUserStatusInfo(
  isBlocked: boolean
): UserStatusInfo {

  if (isBlocked) {
    return {
      label: "Заблокирован",
      style: {
        background: "rgba(220, 80, 80, 0.18)",
        border: "1px solid rgba(220, 80, 80, 0.35)",
        color: "#ff9a9a",
      },
    }
  }

  return {
    label: "Активный",
    style: {
      background: "rgba(60, 220, 140, 0.18)",
      border: "1px solid rgba(60, 220, 140, 0.35)",
      color: "#7dffc3",
    },
  }
}