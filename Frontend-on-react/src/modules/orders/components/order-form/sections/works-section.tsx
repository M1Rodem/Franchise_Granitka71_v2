'use client'

import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'

const GRID = '2fr 1fr 1fr 2fr 120px'

export function WorksSection() {
  const { register, control } =
    useFormContext<OrderFormModel>()

  const { fields, append, remove } =
    useFieldArray({
      control,
      name: 'works',
    })

  const works = useWatch({
    control,
    name: 'works',
  }) as OrderFormModel['works']

  const total = works.reduce<number>((sum, w) => {
    return (
      sum +
      (Number(w?.price) || 0) *
        (Number(w?.quantity) || 0)
    )
  }, 0)

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Виды работ
      </h2>

      <div className={table.dataTable}>
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

        {fields.map((field, index) => (
          <div
            key={field.id}
            className={table.dataRow}
            style={{
              gridTemplateColumns: GRID,
            }}
          >
            <div data-label="Работа">
              <input
                {...register(
                  `works.${index}.workDescription`,
                )}
                className={input.input}
              />
            </div>

            <div data-label="Цена">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                {...register(`works.${index}.price`, { valueAsNumber: true })}
                onFocus={(e) => {
                  if (e.target.value === '0') {
                    e.target.value = ''
                  }
                }}
                className={input.input}
              />
            </div>

            <div data-label="Кол-во">
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                {...register(`works.${index}.quantity`, { valueAsNumber: true })}
                className={input.input}
              />
            </div>

            <div data-label="Примечание">
              <input
                {...register(
                  `works.${index}.note`,
                )}
                className={input.input}
              />
            </div>

            <div data-label="Действия">
              <button
                type="button"
                onClick={() =>
                  remove(index)
                }
                disabled={
                  fields.length === 1
                }
                className={`${button.btn} ${button.btnDanger}`}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

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
        className={`${button.btn} ${button.btnPrimary}`}
        style={{ marginTop: 16 }}
      >
        + Добавить работу
      </button>

      <div className={table.totalBlock}>
        <span>Итоговая сумма:</span>
        <strong>
          {total.toLocaleString('ru-RU')} ₽
        </strong>
      </div>
    </div>
  )
}