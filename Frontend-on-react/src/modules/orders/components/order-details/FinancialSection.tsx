import surface from '@/shared/ui/surface.module.css'
import layout from '@/shared/ui/form-layout.module.css'

interface Payment {
  amount: number
}

interface Props {
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalPrice: number
  payments: Payment[]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function FinancialSection({
  subtotal,
  discountPercent,
  discountAmount,
  totalPrice,
  payments,
}: Props) {

  const paid = payments.reduce(
    (sum, p) => sum + p.amount,
    0
  )

  const remaining = totalPrice - paid
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Финансы</h2>

      <div className={layout.grid2}>

        <div className={layout.field}>
          <span className={layout.label}>Сумма работ</span>
          <span className={layout.value}>
            {formatMoney(subtotal)}
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Скидка</span>
          <span className={layout.value}>
            {discountPercent} %
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Сумма скидки</span>
          <span className={layout.value}>
            {formatMoney(discountAmount)}
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Итого</span>
          <span className={layout.value}>
            <strong>{formatMoney(totalPrice)}</strong>
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Оплачено</span>
          <span className={layout.value}>
            {formatMoney(paid)}
          </span>
        </div>

        <div className={layout.field}>
          <span className={layout.label}>Осталось</span>
          <span className={layout.value}>
            <strong>{formatMoney(remaining)}</strong>
          </span>
        </div>

      </div>
    </section>
  )
}