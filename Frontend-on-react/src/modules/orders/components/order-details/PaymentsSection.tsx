import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'

interface Payment {
  id: number
  amount: number
  paymentType: string
  paymentDate: string
  note?: string | null
}

interface Props {
  items: Payment[]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}

const GRID_TEMPLATE = '1fr 1fr 1fr 2fr'

export function PaymentsSection({ items }: Props) {
  const total = items.reduce(
    (sum, p) => sum + p.amount,
    0,
  )

  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>Платежи</h2>

      {items.length === 0 ? (
        <div className={table.empty}>
          Платежи отсутствуют
        </div>
      ) : (
        <>
          <div className={table.dataTable}>
            <div
              className={table.dataHeader}
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <span>Тип</span>
              <span>Сумма</span>
              <span>Дата</span>
              <span>Примечание</span>
            </div>

            {items.map((item) => (
              <div
                key={item.id}
                className={table.dataRow}
                style={{
                  gridTemplateColumns: GRID_TEMPLATE,
                }}
              >
                <span data-label="Тип">
                  {item.paymentType}
                </span>

                <span data-label="Сумма">
                  {formatMoney(item.amount)}
                </span>

                <span data-label="Дата">
                  {format(
                    new Date(item.paymentDate),
                    'dd MMM yyyy',
                    { locale: ru },
                  )}
                </span>

                <span data-label="Примечание">
                  {item.note || '—'}
                </span>
              </div>
            ))}
          </div>

          <div className={table.totalBlock}>
            <span>Итого:</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </>
      )}
    </section>
  )
}