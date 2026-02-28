'use client'

import { useFormContext, Controller } from 'react-hook-form'
import InputMask from 'react-input-mask'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import input from '@/shared/ui/input.module.css'

export function ClientSection() {
  const {
    register,
    control,
  } = useFormContext<OrderFormModel>()

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Данные заказчика
      </h2>

      <div className={layout.grid2x2}>

        {/* ФИО */}
        <div className={layout.field}>
          <label className={layout.label}>ФИО *</label>
          <input
            {...register('client.fullName')}
            className={input.input}
          />
        </div>

        {/* Email */}
        <div className={layout.field}>
          <label className={layout.label}>Email</label>
          <input
            {...register('client.email')}
            type="email"
            className={input.input}
          />
        </div>

        {/* Телефон */}
        <div className={layout.field}>
          <label className={layout.label}>Телефон *</label>

          <Controller
            control={control}
            name="client.phone"
            render={({ field }) => (
              <InputMask
                {...field}
                mask="+7 (999) 999-99-99"
              >
                {(props: any) => (
                  <input
                    {...props}
                    className={input.input}
                  />
                )}
              </InputMask>
            )}
          />
        </div>

        {/* Адрес */}
        <div className={layout.field}>
          <label className={layout.label}>Адрес *</label>
          <input
            {...register('client.address')}
            className={input.input}
          />
        </div>

      </div>
    </div>
  )
}