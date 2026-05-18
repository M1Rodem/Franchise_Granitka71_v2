import type {
  ReactNode,
  CSSProperties,
} from 'react'

import styles from './status.module.css'

interface StatusBadgeProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export function StatusBadge({
  children,
  style,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={`${styles.status} ${className ?? ''}`}
      style={style}
    >
      {children}
    </span>
  )
}