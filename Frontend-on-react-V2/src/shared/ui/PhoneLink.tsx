'use client'

import styles from './phone-link.module.css'

import { showTempMessage } from '@/shared/ui/temp-message.service'

interface PhoneLinkProps {
  phone: string | null | undefined
  className?: string
}

export function PhoneLink({ phone, className }: PhoneLinkProps) {
  if (!phone) return <span>-</span>

  const normalized = phone.replace(/\D/g, '')
  const tel = `tel:+${normalized}`

  const handleClick = async (
    e: React.MouseEvent<HTMLAnchorElement>
  ) => {
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
      )

    if (!isMobile) {
      e.preventDefault()

      try {
        await navigator.clipboard.writeText(phone)
      } catch {}

      showTempMessage('success', 'Номер скопирован')
    }
  }

  return (
    <a
      href={tel}
      onClick={handleClick}
      className={`${styles.phoneLink} ${className || ''}`}
    >
      {phone}
    </a>
  )
}