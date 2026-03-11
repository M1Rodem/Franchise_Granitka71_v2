'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import styles from './totals-section.module.css'
import input from '@/shared/ui/input.module.css'

export function TotalsSection() {

  const { register, control, setValue } =
    useFormContext<OrderFormModel>()

  const works =
    useWatch({
      control,
      name: 'works',
    }) || []

  const discountPercent =
    useWatch({
      control,
      name: 'discountPercent',
    }) ?? 0

  const subtotal = works.reduce(
    (sum, w) =>
      sum +
      (Number(w?.price) || 0) *
      (Number(w?.quantity) || 0),
    0
  )

  const discountAmount =
    subtotal * (discountPercent / 100)

  const total =
    subtotal - discountAmount

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Итог
      </h2>

      <div className={styles.row}>
        <span>Сумма работ</span>
        <strong>
          {subtotal.toLocaleString('ru-RU')} ₽
        </strong>
      </div>

      <div className={styles.row}>
        <span>Скидка (%)</span>

        <input
            type="number"
            min={0}
            max={10}
            step="0.1"
            {...register('discountPercent', {
                valueAsNumber: true,
                onChange: (e) => {

                let v = Number(e.target.value)

                if (v > 10) v = 10
                if (v < 0) v = 0

                setValue('discountPercent', v, {
                    shouldValidate: true,
                    shouldDirty: true
                })
                }
            })}
            className={input.input || styles.discountInput}
        />
        </div>

      <div className={styles.row}>
        <span>Сумма скидки</span>
        <strong>
          {discountAmount.toLocaleString('ru-RU')} ₽
        </strong>
      </div>

      <div className={styles.total}>
        <span>Итого</span>
        <strong>
          {total.toLocaleString('ru-RU')} ₽
        </strong>
      </div>

    </div>
  )
}