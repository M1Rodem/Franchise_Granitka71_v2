'use client'

import { useFormContext } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import input from '@/shared/ui/input.module.css'

export function AdditionalInfoSection() {
  const { register } = useFormContext<OrderFormModel>()

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Дополнительная информация
      </h2>

      <div className={layout.field}>
        <label className={layout.label}>
          Примечание
        </label>

        <textarea
          {...register('additionalInfo')}
          className={input.textarea}
          rows={4}
          placeholder="Введите дополнительные сведения..."
        />
      </div>
    </div>
  )
}