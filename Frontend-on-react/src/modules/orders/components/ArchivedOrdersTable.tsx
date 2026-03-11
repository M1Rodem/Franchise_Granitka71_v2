import table from '@/shared/ui/table-base.module.css'
import surface from '@/shared/ui/surface.module.css'
import type { OrderResponseDto } from '@/modules/orders/types/orders.types'
import { formatPhone } from '@/shared/lib/phone'

interface ArchivedOrdersTableProps {
  orders: OrderResponseDto[]
  onOpenOrder: (id: number) => void
}

function getDaysLeft(deletedAt?: string | null) {
  if (!deletedAt) return null

  const deletedDate = new Date(deletedAt).getTime()
  const now = Date.now()

  const diffDays = Math.floor((now - deletedDate) / 86400000)
  const daysLeft = 14 - diffDays

  return daysLeft
}

const GRID_TEMPLATE =
  '110px 1.4fr 150px 130px 130px 140px 160px 1fr 1fr'

export function ArchivedOrdersTable({ orders, onOpenOrder }: ArchivedOrdersTableProps) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Архив заказов
      </h2>

      <div className={table.dataTable}>
        <div
          className={table.dataHeader}
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          <span>Номер</span>
          <span>Клиент</span>
          <span>Телефон</span>
          <span>Дата заказа</span>
          <span>Удален</span>
          <span>Статус</span>
          <span>Оплата</span>
          <span>Участок</span>
          <span>До удаления</span>
        </div>

        {orders.map(order => {
          const daysLeft = getDaysLeft((order as any).deletedAt)

          return (
            <div
              key={order.id}
              className={table.dataRow}
              style={{
                gridTemplateColumns: GRID_TEMPLATE,
                cursor: 'pointer',
              }}
              onClick={() => onOpenOrder(order.id)}
            >
              <span>{order.orderNumber}</span>

              <span className={table.primaryCell}>
                {order.customerFullName}
              </span>

              <span>{formatPhone(order.phone)}</span>

              <span>
                {new Date(order.orderDate).toLocaleDateString('ru-RU')}
              </span>

              <span>
                {(order as any).deletedAt
                  ? new Date((order as any).deletedAt).toLocaleDateString('ru-RU')
                  : '-'}
              </span>

              <span>{order.status}</span>

              <span>{order.paymentStatus}</span>

              <span className={table.primaryCell}>
                {order.plotName || '-'}
              </span>

              <span>
                {daysLeft !== null ? `${daysLeft} дн.` : '-'}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}