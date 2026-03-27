import type { FinanceChangeDto } from '../../types/notifications.types'
import surfaceStyles from '@/shared/ui/surface.module.css'

interface Props {
  data: FinanceChangeDto
}

function formatMoney(value: number | undefined) {
  if (value === undefined || value === null) return '—'

  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number | undefined) {
  if (value === undefined || value === null) return '—'
  return `${value}%`
}

export function FinanceDiff({ data }: Props) {
  const oldVal = data.old
  const newVal = data.new

  return (
    <div className={surfaceStyles.surface}>
      <div className={surfaceStyles.diffList}>
        
        {/* WORKS TOTAL */}
        {oldVal.worksTotal !== newVal.worksTotal && (
          <DiffRow
            label="Работы"
            oldValue={formatMoney(oldVal.worksTotal)}
            newValue={formatMoney(newVal.worksTotal)}
          />
        )}

        {/* DISCOUNT */}
        {oldVal.discount !== newVal.discount && (
          <DiffRow
            label="Скидка"
            oldValue={formatPercent(oldVal.discount)}
            newValue={formatPercent(newVal.discount)}
          />
        )}

        {/* DISCOUNT AMOUNT */}
        {oldVal.discountAmount !== newVal.discountAmount && (
          <DiffRow
            label="Сумма скидки"
            oldValue={formatMoney(oldVal.discountAmount)}
            newValue={formatMoney(newVal.discountAmount)}
          />
        )}

        {/* TOTAL */}
        {oldVal.total !== newVal.total && (
          <DiffRow
            label="Итого"
            oldValue={formatMoney(oldVal.total)}
            newValue={formatMoney(newVal.total)}
          />
        )}

        {/* ⚠️ НЕ показываем paid / remaining */}
      </div>
    </div>
  )
}

function DiffRow({
  label,
  oldValue,
  newValue,
}: {
  label: string
  oldValue: string
  newValue: string
}) {
  const changed = oldValue !== newValue

  return (
    <div className={surfaceStyles.diffField}>
      <div className={surfaceStyles.diffLabel}>{label}</div>

      <div className={surfaceStyles.diffValues}>
        <span
          className={
            changed
              ? surfaceStyles.diffOldChanged
              : surfaceStyles.diffOld
          }
        >
          <span className={surfaceStyles.hideOnDesktop}>Было: </span>
          {oldValue}
        </span>

        <span className={surfaceStyles.diffArrow}>→</span>

        <span
          className={
            changed
              ? surfaceStyles.diffNewChanged
              : surfaceStyles.diffNew
          }
        >
          <span className={surfaceStyles.hideOnDesktop}>Стало: </span>
          {newValue}
        </span>
      </div>
    </div>
  )
}