'use client'

import { useFormContext } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import input from '@/shared/ui/input.module.css'

export function MonumentSection() {
  const { register } = useFormContext<OrderFormModel>()

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Монумент
      </h2>

      <div className={layout.grid2}>

        <div className={layout.field}>
          <label className={layout.label}>
            Тип памятника
          </label>
          <input
            {...register('monument.type')}
            className={input.input}
          />
        </div>

        <div className={layout.field}>
          <label className={layout.label}>
            Размер
          </label>
          <input
            {...register('monument.size')}
            className={input.input}
          />
        </div>

      </div>
    </div>
  )
}