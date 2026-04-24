import surface from '@/shared/ui/surface.module.css'
import { StatusBadge } from '@/shared/ui/status'
import { getPaymentStatusInfo } from '@/modules/orders/lib/payment-status'

interface Payment {
  amount: number
}

interface Props {
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalPrice: number
  payments: Payment[]
  paymentStatus: number
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
  paymentStatus,
}: Props) {

  const round = (v: number) =>
    Math.round(v * 100) / 100

  const paid = round(
    payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  )

  const remaining = round(
    Math.max(0, totalPrice - paid)
  )

  const paymentStatusInfo =
    getPaymentStatusInfo(paymentStatus ?? 0)

  return (
    <section className={surface.surface}>

      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <h2 className={surface.sectionTitle}>Финансы</h2>

        <StatusBadge style={paymentStatusInfo.style}>
          {paymentStatusInfo.label}
        </StatusBadge>
      </div>

      {/* 🔹 БЛОК 1 */}
      <div className={surface.financeGrid}>

        {/* 1 строка */}
        <div className={surface.financeItem}>
          <span>Сумма работ</span>
          <strong>{formatMoney(subtotal)}</strong>
        </div>

        <div className={surface.financeItem}>
          <span>Итого</span>
          <strong>{formatMoney(totalPrice)}</strong>
        </div>

        <div className={surface.financeItem}>
          <span>Скидка</span>
          <strong>{discountPercent} %</strong>
        </div>

        {/* 2 строка */}
        <div className={surface.financeItem}>
          <span>Сумма скидки</span>
          <strong>{formatMoney(discountAmount)}</strong>
        </div>


        <div className={surface.financeItem}>
          <span>Оплачено</span>
          <strong>{formatMoney(paid)}</strong>
        </div>

        <div className={surface.financeItem}>
          <span>Осталось</span>
          <strong>{formatMoney(remaining)}</strong>
        </div>

      </div>

    </section>
  )
}