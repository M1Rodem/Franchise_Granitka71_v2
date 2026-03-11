import table from '@/shared/ui/table-base.module.css'
import surface from '@/shared/ui/surface.module.css'

import type { OrderResponseDto } from '@/modules/orders/types/orders.types'
import { formatPhone } from '@/shared/lib/phone'

import {
  paymentStatusLabels,
  getPaymentBadgeStyle
} from '@/modules/orders/lib/payment-status'

interface OrdersTableProps {
  orders: OrderResponseDto[]
  onOpenOrder: (id: number) => void
}

const statusLabels: Record<number, string> = {
  0: 'Новый',
  1: 'В работе',
  2: 'Оплата',
  3: 'Готов',
  4: 'Доставлен',
}

const GRID_TEMPLATE =
  '110px 1.4fr 150px 130px 140px 160px 1fr 1fr'

export function OrdersTable({
  orders,
  onOpenOrder,
}: OrdersTableProps) {
  return (
    <section className={surface.surface}>
      <h2 className={surface.sectionTitle}>
        Список заказов
      </h2>

      <div className={table.dataTable}>
        <div
          className={table.dataHeader}
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          <span>Номер</span>
          <span>Клиент</span>
          <span>Телефон</span>
          <span>Дата</span>
          <span>Статус</span>
          <span>Оплата</span>
          <span>Участок</span>
          <span>Менеджер</span>
        </div>

        {orders.map((order) => {
          const status =
            typeof order.status === 'number'
              ? statusLabels[order.status] ??
                `Статус ${order.status}`
              : order.status

          const paymentStatus =
            typeof order.paymentStatus === 'number'
              ? paymentStatusLabels[
                  order.paymentStatus
                ] ?? `Статус ${order.paymentStatus}`
              : order.paymentStatus ?? '—'

          const badgeStyle =
            getPaymentBadgeStyle(paymentStatus)

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
              <span data-label="Номер">
                {order.orderNumber ||
                  `#${order.id}`}
              </span>

              <span
                data-label="Клиент"
                className={table.primaryCell}
              >
                {order.customerFullName || '-'}
              </span>

              <span data-label="Телефон">
                {formatPhone(order.phone) || '-'}
              </span>

              <span data-label="Дата">
                {new Date(order.orderDate).toLocaleDateString('ru-RU')}
              </span>

              <span data-label="Статус">
                {status}
              </span>

              <span data-label="Оплата">
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    display: 'inline-flex',
                    justifyContent: 'center',
                    ...badgeStyle,
                  }}
                >
                  {paymentStatus}
                </span>
              </span>


              <span
                data-label="Участок"
                className={table.primaryCell}
              >
                {order.plotName || '-'}
              </span>

              <span
                data-label="Менеджер"
                className={table.primaryCell}
              >
                {order.managerFullName || '-'}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}