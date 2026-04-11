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
import { useOrderForm } from '../order-form.provider'
import { showTempMessage } from '@/shared/ui/temp-message.service'
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
    setValue,
    formState: { errors, dirtyFields },
  } = useFormContext<OrderFormModel>()

  const { mode } = useOrderForm()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'payments',
  })

  const payments =
    useWatch({
      control,
      name: 'payments',
    }) || []

  const works =
    useWatch({
      control,
      name: "works"
    }) || []

  const discountPercent =
    useWatch({
      control,
      name: "discountPercent"
    }) ?? 0

  const subtotal = works.reduce(
    (sum, w) =>
      sum +
      (Number(w?.price) || 0) *
      (Number(w?.quantity) || 0),
    0
  )

  const roundMoney = (value: number) =>
    Math.round(value * 100) / 100

  const advanceIndex = payments.findIndex(
    (p) => p?.paymentType === "Аванс"
  )

  const applySuggestedAdvance = () => {

    if (advanceIndex === -1) return

    setValue(
      `payments.${advanceIndex}.amount`,
      suggestedAdvance,
      {
        shouldDirty: true,
        shouldValidate: true
      }
    )

  }

  const discountAmount =
    subtotal * (discountPercent / 100)

  const total =
    roundMoney(subtotal - discountAmount)

  const suggestedAdvance =
    Math.round(total * 0.3)

  const getMaxForPayment = (index: number) => {

    const othersSum = payments.reduce((sum, p, i) => {
      if (i === index) return sum
      return sum + (Number(p?.amount) || 0)
    }, 0)

    return roundMoney(Math.max(0, total - othersSum))

  }

  const totalPaid = roundMoney(
    payments.reduce<number>((sum, p) => {
      return sum + (Number(p?.amount) || 0)
    }, 0)
  )

  const remaining = roundMoney(Math.max(0, total - totalPaid))

  const isAdvanceEnough = totalPaid >= suggestedAdvance

  return (
    <div className={surface.surface}>
      <div className={styles.headerRow}>
        <h2 className={surface.sectionTitle}>
          Платежи
        </h2>

        {advanceIndex !== -1 &&
          !isAdvanceEnough &&
          (
            mode === "edit" ||
            dirtyFields?.payments?.[advanceIndex]?.amount
          ) && (

            <div className={styles.advanceHint}>
              <span className={styles.advanceText}>
                Рекомендуемый аванс (30%):
                <strong>
                  {" "}
                  {suggestedAdvance.toLocaleString("ru-RU")} ₽
                </strong>
              </span>

              <button
                type="button"
                onClick={applySuggestedAdvance}
                className={`${button.btn} ${button.btnSuccess}`}
              >
                Применить 30%
              </button>
            </div>

          )}

      </div>

      <div
        className={`${table.dataTable} ${styles.dataTableFix}`}
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
              className={`${table.dataRow} ${styles.mobileCard}`}
              style={{
                gridTemplateColumns: GRID,
              }}
            >
              {/* Тип */}
              <div
                className={styles.mobileRow}
              >
                <span>Тип</span>

                <Controller
                  control={control}
                  name={`payments.${index}.paymentType`}
                  render={({ field }) => (
                    <AnimatedSelect
                      value={field.value}
                      options={PAYMENT_TYPES}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              {/* Сумма + Дата */}
              <div className={styles.mobileGrid2}>

                <div className={styles.mobileRow}>
                  <span>Сумма</span>

                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Сумма"
                    {...register(`payments.${index}.amount`, {
                      valueAsNumber: true,
                      onChange: (e) => {

                        let value = Number(e.target.value) || 0

                        // 2 знака после запятой
                        value = Math.round(value * 100) / 100

                        const max = getMaxForPayment(index)

                        if (value > max) {
                          value = max

                          showTempMessage(
                            'warning',
                            `Максимальная сумма этого платежа: ${max.toLocaleString('ru-RU', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })} ₽`
                          )
                        }

                        setValue(
                          `payments.${index}.amount`,
                          value,
                          { shouldDirty: true }
                        )
                      }
                    })}
                    className={input.input}
                    max={getMaxForPayment(index)}
                  />
                </div>

                <div className={styles.mobileRow}>
                  <span>Дата</span>

                  <Controller
                    control={control}
                    name={`payments.${index}.paymentDate`}
                    render={({ field }) => (
                      <OrdersDateInput
                        label=""
                        isoValue={field.value}
                        onCommit={field.onChange}
                      />
                    )}
                  />
                </div>

              </div>

              {/* Примечание */}
              <div className={styles.mobileRow}>
                <span>Примечание</span>

                <input
                  placeholder="Комментарий"
                  {...register(`payments.${index}.note`)}
                  className={input.input}
                />
              </div>

              {/* Действия */}
              <div className={styles.mobileActions}>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1 || isOnlyAdvance}
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
          disabled={remaining <= 0}
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