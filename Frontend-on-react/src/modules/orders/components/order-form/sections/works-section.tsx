'use client'

import {
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'

const GRID = '2fr 1fr 1fr 2fr 120px'

export function WorksSection() {
  const { register, control } =
    useFormContext<OrderFormModel>()

  const { fields } =
    useFieldArray({
      control,
      name: 'works',
    })

  const works = useWatch({
    control,
    name: 'works',
  }) || []

  console.log('FIELDS:', fields)
  console.log('WATCH WORKS:', works)

  const total = works.reduce<number>((sum, w) => {
    return sum +
      (Number(w?.price) || 0) *
      (Number(w?.quantity) || 0)
  }, 0)

  console.log('TOTAL:', total)

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Виды работ
      </h2>

      <div className={table.dataTable}>
        {fields.map((field, index) => (
          <div
            key={field.id}
            className={table.dataRow}
            style={{ gridTemplateColumns: GRID }}
          >
            <input
              {...register(`works.${index}.workDescription`)}
              className={input.input}
            />

            <input
              type="number"
              {...register(`works.${index}.price`, {
                valueAsNumber: true,
              })}
              className={input.input}
            />

            <input
              type="number"
              {...register(`works.${index}.quantity`, {
                valueAsNumber: true,
              })}
              className={input.input}
            />

            <input
              {...register(`works.${index}.note`)}
              className={input.input}
            />
          </div>
        ))}
      </div>

      <div className={table.totalBlock}>
        <span>Итоговая сумма:</span>
        <strong>
          {total.toLocaleString('ru-RU')} ₽
        </strong>
      </div>
    </div>
  )
}