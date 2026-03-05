'use client'

import { useFormContext, Controller } from 'react-hook-form'
import { IMaskInput } from 'react-imask'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'
import input from '@/shared/ui/input.module.css'

export function ClientSection() {
  const { register, control } = useFormContext<OrderFormModel>()

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
            placeholder="Иванов Иван Иванович"
            className={input.input}
          />
        </div>

        {/* Email */}
        <div className={layout.field}>
          <label className={layout.label}>Email</label>
          <input
            {...register('client.email')}
            type="email"
            placeholder="example@mail.ru"
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
              <IMaskInput
                mask="+7 (000) 000-00-00"
                value={field.value}
                unmask={false}
                lazy={false}
                placeholder="+7 (___) ___-__-__"
                className={input.input}
                onAccept={(value) =>
                  field.onChange(String(value))
                }
              />
            )}
          />
        </div>

        {/* Адрес */}
        <div className={layout.field}>
          <label className={layout.label}>Адрес *</label>
          <input
            {...register('client.address')}
            placeholder="Адрес проживания"
            className={input.input}
          />
        </div>

      </div>
    </div>
  )
}