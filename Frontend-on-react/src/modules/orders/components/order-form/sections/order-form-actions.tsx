'use client'

import { useFormContext } from 'react-hook-form'
import { useIsMutating } from '@tanstack/react-query'

import button from '@/shared/ui/button.module.css'
import styles from './order-form-actions.module.css'

export function OrderFormActions() {

  const {
    formState: { isSubmitting },
  } = useFormContext()

  const isMutating = useIsMutating()

  const loading = isSubmitting || isMutating > 0

  return (
    <div className={styles.actionsWrapper}>
      <button
        type="submit"
        disabled={loading}
        className={`${button.btn} ${button.btnPrimary} ${styles.fullWidthBtn}`}
      >
        {loading ? 'Создание...' : 'Создать заказ'}
      </button>
    </div>
  )
}