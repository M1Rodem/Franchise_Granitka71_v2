'use client'

import {
  useFieldArray,
  useFormContext,
  Controller,
  useWatch,
} from 'react-hook-form'
import { AnimatedSelect } from '@/shared/ui/AnimatedSelect'
import { OrdersDateInput } from '@/modules/orders/components/OrdersDateInput'
import type { OrderFormModel } from '../order-form.schema'
import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'
import styles from './payments-section.module.css'

const GRID = '1.5fr 1fr 1.2fr 2fr 120px'

const PAYMENT_TYPES = [
  { value: 'Аванс', label: 'Аванс' },
  { value: 'Доплата', label: 'Доплата' },
]

export function PaymentsSection() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<OrderFormModel>()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'payments',
  })

  const payments =
    useWatch({
      control,
      name: 'payments',
    }) || []

  const totalPaid = payments.reduce<number>((sum, p) => {
    return sum + (Number(p?.amount) || 0)
  }, 0)

  return (
    <div className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Платежи
      </h2>

      <div
        className={table.dataTable}
        style={{ position: 'relative', zIndex: 5 }}
      >
        <div
          className={table.dataHeader}
          style={{
            gridTemplateColumns: GRID,
          }}
        >
          <span>Тип</span>
          <span>Сумма</span>
          <span>Дата</span>
          <span>Примечание</span>
          <span></span>
        </div>

        {fields.map((field, index) => {
          const advanceCount = payments.filter(
            (p) => p?.paymentType === 'Аванс',
          ).length

          const isOnlyAdvance =
            payments[index]?.paymentType ===
              'Аванс' &&
            advanceCount === 1

          return (
            <div
              key={field.id}
              className={table.dataRow}
              style={{
                gridTemplateColumns: GRID,
              }}
            >
              <div
                data-label="Тип"
                style={{
                  position: 'relative',
                  zIndex: 100,
                }}
              >
                <Controller
                  control={control}
                  name={`payments.${index}.paymentType`}
                  render={({ field }) => (
                    <AnimatedSelect
                      value={field.value}
                      options={PAYMENT_TYPES}
                      onChange={
                        field.onChange
                      }
                    />
                  )}
                />
              </div>

              <div data-label="Сумма">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Сумма"
                  {...register(`payments.${index}.amount`, {
                    valueAsNumber: true,
                  })}
                  className={input.input}
                />
              </div>

              <div data-label="Дата" className={styles.dateCell}>
                <Controller
                  control={control}
                  name={`payments.${index}.paymentDate`}
                  render={({ field }) => (
                    <OrdersDateInput
                      label=""
                      isoValue={
                        field.value
                      }
                      onCommit={
                        field.onChange
                      }
                    />
                  )}
                />
              </div>

              <div data-label="Примечание">
                <input
                  placeholder="Комментарий"
                  {...register(`payments.${index}.note`)}
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
                    fields.length === 1 ||
                    isOnlyAdvance
                  }
                  className={`${button.btn} ${button.btnDanger} ${styles.deleteButton}`}
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
              paymentType: 'Доплата',
              amount: 0,
              paymentDate:
                new Date().toISOString().split('T')[0],
              note: '',
            })
          }
          className={`${button.btn} ${button.btnPrimary} ${table.fullWidthButton}`}
        >
          + Добавить платеж
        </button>
      </div>

      <div className={table.totalBlock}>
        <span>Сумма платежей:</span>
        <strong>
          {totalPaid.toLocaleString(
            'ru-RU',
          )}{' '}
          ₽
        </strong>
      </div>

      {errors.payments && (
        <span>
          {errors.payments
            .message as string}
        </span>
      )}
    </div>
  )
}