import table from '@/shared/ui/table-base.module.css'

import type {
  ManagerFinanceOrderDto,
  ManagerFinanceSummaryDto,
} from '../types/reports.types'

import { useNavigate } from 'react-router-dom'

interface FinanceOrdersTableProps {
  orders: ManagerFinanceOrderDto[]
  summary: ManagerFinanceSummaryDto
}

const GRID_TEMPLATE =
  '140px 120px 1.6fr 160px 160px 160px'

const formatMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU').format(value)

export function FinanceOrdersTable({
  orders,
}: FinanceOrdersTableProps) {
  const navigate = useNavigate()
  return (
    <>
      <div className={table.dataTable}>
        <div
          className={table.dataHeader}
          style={{
            gridTemplateColumns: GRID_TEMPLATE,
          }}
        >
          <span>Заказ</span>
          <span>Дата</span>
          <span>Клиент</span>
          <span>Продано</span>
          <span>Получено</span>
          <span>Остаток</span>
        </div>

        {orders.length === 0 && (
          <div className={table.empty}>
            Заказы не найдены
          </div>
        )}

        {orders.map(order => (
            <div
                key={order.orderId}
                className={table.dataRow}
                style={{
                gridTemplateColumns: GRID_TEMPLATE,
                cursor: 'pointer',
                }}
                onClick={() =>
                navigate(`/orders/${order.orderId}`)
                }
            >
            <span
              data-label="Заказ"
              className={table.primaryCell}
            >
              {order.orderNumber}
            </span>

            <span data-label="Дата">
              {new Date(
                order.orderDate
              ).toLocaleDateString('ru-RU')}
            </span>

            <span
              data-label="Клиент"
              className={table.primaryCell}
            >
              {order.customerName}
            </span>

            <span data-label="Продано">
              {formatMoney(order.totalPrice)}
            </span>

            <span data-label="Получено">
              {formatMoney(order.paidAmount)}
            </span>

            <span data-label="Остаток">
              {formatMoney(order.debtAmount)}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}