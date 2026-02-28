'use client'

import { useFormContext } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import styles from './additional-info-section.module.css'

export function AdditionalInfoSection() {
  const { register } = useFormContext<OrderFormModel>()

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Дополнительная информация</h2>

      <textarea
        {...register('additionalInfo')}
        className="textarea"
        rows={4}
        placeholder="Введите дополнительные сведения..."
      />
    </div>
  )
}