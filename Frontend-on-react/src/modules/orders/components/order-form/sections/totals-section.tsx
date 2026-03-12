'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import styles from './totals-section.module.css'
import input from '@/shared/ui/input.module.css'

const GRID = '2fr 1fr'

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

      <div className={table.dataTable}>

        <div
          className={table.dataHeader}
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Показатель</span>
          <span>Значение</span>
        </div>

        <div
          className={table.dataRow}
          style={{ gridTemplateColumns: GRID }}
        >
          <span data-label="Сумма работ">
            Сумма работ
          </span>

          <strong data-label="Значение">
            {subtotal.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} ₽
          </strong>
        </div>

        <div
          className={table.dataRow}
          style={{ gridTemplateColumns: GRID }}
        >
          <span data-label="Скидка (%)">
            Скидка (%)
          </span>

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
            className={`${input.input}`}
            data-label="Значение"
          />
        </div>

        <div
          className={table.dataRow}
          style={{ gridTemplateColumns: GRID }}
        >
          <span data-label="Сумма скидки">
            Сумма скидки
          </span>

          <strong data-label="Значение">
            {discountAmount.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} ₽
          </strong>
        </div>

        <div
          className={`${table.dataRow} ${styles.totalRow}`}
          style={{ gridTemplateColumns: GRID }}
        >
          <span data-label="Итого">
            Итого
          </span>

          <strong data-label="Значение">
            {total.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })} ₽
          </strong>
        </div>

      </div>
    </div>
  )
}