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
  const { register, control, setValue } =
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
        {fields.map((field, index) => {
          const isDistanceRow = field.workDescription === 'Расстояние'

          return (
            <div
              key={field.id}
              className={`${table.dataRow} ${styles.mobileCard}`}
              style={{ gridTemplateColumns: GRID }}
            >
              {/* Работа */}
              <div className={styles.mobileRow}>
                <span className={table.label}>Работа</span>
                <input
                  placeholder="Название работы"
                  {...register(`works.${index}.workDescription`)}
                  className={input.input}
                  disabled={isDistanceRow}
                />
              </div>

              {/* Цена + Кол-во */}
              <div className={styles.mobileGrid2}>
                <div className={styles.mobileRow}>
                  <span className={table.label}>Цена</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Цена"
                    {...register(`works.${index}.price`, {
                      valueAsNumber: true,
                      onChange: (e) => {
                        let value = Number(e.target.value) || 0

                        // округление как в payments
                        value = Math.round(value * 100) / 100

                        setValue(
                          `works.${index}.price`,
                          value,
                          { shouldDirty: true }
                        )
                      }
                    })}
                    className={input.input}
                  />
                </div>

                <div className={styles.mobileRow}>
                  <span className={table.label}>Кол-во</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Кол-во"
                    {...register(`works.${index}.quantity`, {
                      valueAsNumber: true,
                      onChange: (e) => {
                        let value = Number(e.target.value) || 0

                        // можно ограничить минимум
                        if (value < 0) value = 0

                        setValue(
                          `works.${index}.quantity`,
                          value,
                          { shouldDirty: true }
                        )
                      }
                    })}
                    className={input.input}
                    disabled={isDistanceRow}
                  />
                </div>
              </div>

              {/* Примечание */}
              <div className={styles.mobileRow}>
                <span className={table.label}>Примечание</span>
                <textarea
                  placeholder="Коментарий"
                  {...register(`works.${index}.note`)}
                  className={`${input.textarea} ${styles.compactTextarea}`}
                  readOnly={isDistanceRow}
                />
              </div>

              {/* Действия */}
              <div className={styles.mobileActions}>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1 || isDistanceRow}
                  className={`${button.btn} ${button.btnDanger} ${styles.fullWidthButton}`}
                >
                  Удалить
                </button>
              </div>
            </div>
          )
        })}

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