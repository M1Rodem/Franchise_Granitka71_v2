'use client'

import { useFormContext } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import input from '@/shared/ui/input.module.css'

export function DeceasedSection() {
  const {
    register,
  } = useFormContext<OrderFormModel>()

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        ФИО и даты усопшего
      </h2>

      <div className={layout.field}>
        <label className={layout.label}>
          Данные *
        </label>

        <textarea
          {...register('deceasedFullName')}
          className={input.textarea}
          rows={4}
        />
      </div>

      <span className={layout.hint}>
        Можно указать нескольких. Каждый с новой строки.
      </span>
    </div>
  )
}