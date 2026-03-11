'use client'

import {
  useFieldArray,
  useFormContext,
} from 'react-hook-form'

import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'
import styles from './works-section.module.css'

const GRID = '2fr 1fr 1fr 2fr 120px'

export function WorksSection() {
  const { register, control } =
    useFormContext<OrderFormModel>()

  const { fields, append, remove } =
    useFieldArray({
      control,
      name: 'works',
    })

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Виды работ
      </h2>

      <div className={table.dataTable}>

        {/* HEADER */}
        <div
          className={table.dataHeader}
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Работа</span>
          <span>Цена</span>
          <span>Кол-во</span>
          <span>Примечание</span>
          <span></span>
        </div>

        {/* ROWS */}
        {fields.map((field, index) => (
          <div
            key={field.id}
            className={table.dataRow}
            style={{ gridTemplateColumns: GRID }}
          >
            <div data-label="Работа">
              <input
                {...register(`works.${index}.workDescription`)}
                placeholder="Название работы"
                className={input.input}
              />
            </div>

            <div data-label="Цена">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                {...register(`works.${index}.price`, { valueAsNumber: true })}
                placeholder="Цена"
                className={input.input}
              />
            </div>

            <div data-label="Кол-во">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                {...register(`works.${index}.quantity`, { valueAsNumber: true })}
                placeholder="Количество"
                className={input.input}
              />
            </div>

            <div data-label="Примечание">
              <input
                {...register(`works.${index}.note`)}
                placeholder="Комментарий"
                className={input.input}
              />
            </div>

            <div data-label="Действия">
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                  className={`${button.btn} ${button.btnDanger} ${styles.deleteButton}`}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}

      </div>

      {/* ADD BUTTON */}

      <div className={table.fullWidthAction}>
        <button
          type="button"
          onClick={() =>
            append({
              workDescription: '',
              price: 0,
              quantity: 1,
              note: '',
            })
          }
          className={`${button.btn} ${button.btnPrimary} ${table.fullWidthButton}`}
        >
          + Добавить работу
        </button>
      </div>
    </div>
  )
}