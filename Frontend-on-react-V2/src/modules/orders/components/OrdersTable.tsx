import table from '@/shared/ui/table-base.module.css'
import { StatusBadge } from "@/shared/ui/status"

import type { OrderResponseDto } from '@/modules/orders/types/orders.types'
import { formatPhone } from '@/shared/lib/phone'

import { getPaymentStatusInfo } from '@/modules/orders/lib/payment-status'
import { getOrderStatusInfo }  from '@/modules/orders/lib/order-status'

interface OrdersTableProps {
  orders: OrderResponseDto[]
  onOpenOrder: (id: number) => void
}

const GRID_TEMPLATE =
  '110px 1.4fr 150px 90px 180px 150px 190px 1fr'

export function OrdersTable({
  orders,
  onOpenOrder,
}: OrdersTableProps) {
  return (
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
        const orderStatusInfo =
          getOrderStatusInfo(
            typeof order.status === 'number'
              ? order.status
              : null
          )

        const paymentStatusInfo =
          getPaymentStatusInfo(
            typeof order.paymentStatus === "number"
              ? order.paymentStatus
              : 0
          )

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

              <StatusBadge
                style={orderStatusInfo.style}
              >
                {orderStatusInfo.label}
              </StatusBadge>

            </span>

            <span data-label="Оплата">
              <StatusBadge style={paymentStatusInfo.style}>
                {paymentStatusInfo.label}
              </StatusBadge>
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
  )
}