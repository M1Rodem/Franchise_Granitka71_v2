'use client'

import {
  useFieldArray,
  useFormContext,
  useWatch
} from 'react-hook-form'

import type { OrderFormModel } from '../order-form.schema'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'
import styles from './works-section.module.css'

const GRID = '2fr 1fr 1fr 2fr 120px'
const DISTANCE_GRID = '2fr 1fr 1fr 1fr 1fr 2fr'

// 🔥 helper
const normalizeNumber = (v: any, min = 0) => {
  const num = Number(v)
  if (isNaN(num) || num < min) return min
  return num
}

export function WorksSection() {
  const { register, control, setValue } =
    useFormContext<OrderFormModel>()

  const { fields, append, remove } =
    useFieldArray({
      control,
      name: 'works',
    })

  const round = (v: number) =>
    Math.round(v * 100) / 100

  const works = useWatch({
    control,
    name: 'works'
  }) || []

  const distanceIndex =
    works.findIndex(w => w.isDistanceWork)

  const distance =
    distanceIndex !== -1
      ? works[distanceIndex]
      : null

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Виды работ
      </h2>

      {distance && (
        <div className={table.dataTable}>

          <div
            className={table.dataHeader}
            style={{ gridTemplateColumns: DISTANCE_GRID }}
          >
            <span>Работа</span>
            <span>Цена</span>
            <span>КМ</span>
            <span>Рейсы</span>
            <span>Итого</span>
            <span>Примечание</span>
          </div>

          <div
            className={table.dataRow}
            style={{ gridTemplateColumns: DISTANCE_GRID }}
          >

            {/* Работа */}
            <input
              value={distance.workDescription}
              readOnly
              disabled
              className={input.input}
            />

            {/* Цена */}
            <input
              type="number"
              inputMode="numeric"
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              {...register(`works.${distanceIndex}.price`, {
                valueAsNumber: true,
                onChange: (e) => {
                  const value = normalizeNumber(e.target.value)
                  setValue(`works.${distanceIndex}.price`, value, {
                    shouldDirty: true
                  })
                }
              })}
              className={input.input}
            />

            {/* KM (с карты) */}
            <input
              value={distance.distanceKm ?? 0}
              readOnly
              disabled
              className={input.input}
            />

            {/* ROUTES */}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}

              {...register(`works.${distanceIndex}.routes`, {
                valueAsNumber: true,
                onChange: (e) => {
                  let value = e.target.value

                  if (value === '') {
                    setValue(`works.${distanceIndex}.routes`, 1)
                    return
                  }

                  let num = Number(value)

                  if (isNaN(num) || num < 1) num = 1

                  setValue(`works.${distanceIndex}.routes`, num, {
                    shouldDirty: true,
                    shouldValidate: true
                  })
                }
              })}

              onFocus={(e) => {
                if (e.target.value === '1') {
                  e.target.select()
                }
              }}

              onBlur={(e) => {
                if (!e.target.value || Number(e.target.value) < 1) {
                  setValue(`works.${distanceIndex}.routes`, 1)
                }
              }}

              className={input.input}
            />

            {/* ИТОГО */}
            <input
              value={
                round(
                  (Number(distance.routes) || 0) *
                  (Number(distance.distanceKm) || 0)
                )
              }
              readOnly
              disabled
              className={input.input}
            />

            {/* NOTE */}
            <textarea
              value={distance.note ?? ''}
              readOnly
              disabled
              className={`${input.textarea} ${styles.compactTextarea}`}
            />
          </div>
        </div>
      )}

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

        {fields.map((field, index) => {
          if (field.isDistanceWork) return null

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
                  {...register(`works.${index}.workDescription`)}
                  className={input.input}
                />
              </div>

              {/* Цена + Кол-во */}
              <div className={styles.mobileGrid2}>

                <div className={styles.mobileRow}>
                  <span className={table.label}>Цена</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    {...register(`works.${index}.price`, {
                      valueAsNumber: true,
                      onChange: (e) => {
                        let value = normalizeNumber(e.target.value)
                        value = Math.round(value * 100) / 100

                        setValue(`works.${index}.price`, value, {
                          shouldDirty: true
                        })
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
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    {...register(`works.${index}.quantity`, {
                      valueAsNumber: true,
                      onChange: (e) => {
                        let value = normalizeNumber(e.target.value)

                        setValue(`works.${index}.quantity`, value, {
                          shouldDirty: true
                        })
                      }
                    })}
                    className={input.input}
                  />
                </div>

              </div>

              {/* NOTE */}
              <div className={styles.mobileRow}>
                <span className={table.label}>Примечание</span>
                <textarea
                  {...register(`works.${index}.note`)}
                  className={`${input.textarea} ${styles.compactTextarea}`}
                />
              </div>

              {/* ACTION */}
              <div className={styles.mobileActions}>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className={`${button.btn} ${button.btnDanger} ${styles.fullWidthButton}`}
                >
                  Удалить
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className={table.fullWidthAction}>
        <button
          type="button"
          onClick={() =>
            append({
              id: undefined,
              workDescription: '',
              price: 0,
              quantity: 1,
              isDistanceWork: false,
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