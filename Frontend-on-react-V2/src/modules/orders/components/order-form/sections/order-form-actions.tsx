'use client'

import { useFormContext } from 'react-hook-form'
import { useIsMutating } from '@tanstack/react-query'

import button from '@/shared/ui/button.module.css'
import styles from './order-form-actions.module.css'

interface Props {
  mode?: 'create' | 'edit'
}

export function OrderFormActions({ mode = 'create' }: Props) {

  const {
    formState: { isSubmitting },
  } = useFormContext()

  const isMutating = useIsMutating()

  const loading = isSubmitting || isMutating > 0

  const text =
    mode === 'edit'
      ? loading
        ? 'Сохранение...'
        : 'Сохранить заказ'
      : loading
      ? 'Создание...'
      : 'Создать заказ'

  return (
    <div className={styles.actionsWrapper}>
      <button
        type="submit"
        disabled={loading}
        className={`${button.btn} ${button.btnPrimary} ${styles.fullWidthBtn}`}
      >
        {text}
      </button>
    </div>
  )
}