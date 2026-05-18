import table from '@/shared/ui/table-base.module.css';
import { StatusBadge } from '@/shared/ui/status';
import type { OrderResponseDto } from '@/modules/orders/types/orders.types';
import { formatPhone } from '@/shared/lib/phone';
import { getPaymentStatusInfo } from '@/modules/orders/lib/payment-status';
import { getOrderStatusInfo } from '@/modules/orders/lib/order-status'

interface ArchivedOrdersTableProps {
  orders: OrderResponseDto[];
  onOpenOrder: (id: number) => void;
}

function getDaysLeft(deletedAt?: string | null) {
  if (!deletedAt) return null;

  const deletedDate = new Date(deletedAt).getTime();
  const now = Date.now();

  const diffDays = Math.floor((now - deletedDate) / 86400000);
  const daysLeft = 14 - diffDays;

  return daysLeft;
}

function getDaysLeftStyle(
  daysLeft: number | null
) {

  if (daysLeft === null) {
    return {}
  }

  if (daysLeft < 3) {
    return {
      background:
        'rgba(120, 70, 70, 0.18)',

      borderColor:
        'rgba(210, 120, 120, 0.20)',

      color:
        'rgba(255, 210, 210, 0.92)',
    }
  }

  if (daysLeft <= 7) {
    return {
      background:
        'rgba(120, 119, 90, 0.16)',

      borderColor:
        'rgba(214, 190, 120, 0.18)',

      color:
        'rgba(255, 232, 170, 0.92)',
    }
  }

  return {
    background:
      'rgba(80, 110, 145, 0.16)',

    borderColor:
      'rgba(120, 170, 220, 0.18)',

    color:
      'rgba(210, 232, 255, 0.92)',
  }
}

const GRID_TEMPLATE = '110px 1.5fr 150px 130px 130px 220px 180px 1fr 170px';

export function ArchivedOrdersTable({ orders, onOpenOrder }: ArchivedOrdersTableProps) {
  return (
    <div className={table.dataTable}>
      <div className={table.dataHeader} style={{ gridTemplateColumns: GRID_TEMPLATE }}>
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

      {orders.map((order) => {
        const daysLeft = getDaysLeft((order as any).deletedAt);

        const orderStatusInfo =
          getOrderStatusInfo(
            typeof order.status === 'number'
              ? order.status
              : null
          )

        const paymentStatusInfo = getPaymentStatusInfo(
          typeof order.paymentStatus === 'number' ? order.paymentStatus : 0,
        );

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
            <span data-label="Номер">{order.orderNumber}</span>

            <span data-label="Клиент" className={table.primaryCell}>
              {order.customerFullName}
            </span>

            <span data-label="Телефон">{formatPhone(order.phone)}</span>

            <span data-label="Дата заказа">
              {new Date(order.orderDate).toLocaleDateString('ru-RU')}
            </span>

            <span data-label="Удален">
              {(order as any).deletedAt
                ? new Date((order as any).deletedAt).toLocaleDateString('ru-RU')
                : '-'}
            </span>

            <span
              data-label="Статус"
              style={{
                overflow: 'hidden',
              }}
            >

              <StatusBadge
                style={orderStatusInfo.style}
              >
                {orderStatusInfo.label}
              </StatusBadge>

            </span>

            <span
              data-label="Оплата"
              style={{
                overflow: 'hidden',
              }}
            >
              <StatusBadge style={paymentStatusInfo.style}>{paymentStatusInfo.label}</StatusBadge>
            </span>

            <span data-label="Участок" className={table.primaryCell}>
              {order.plotName || '-'}
            </span>

            <span data-label="До удаления">
              {daysLeft !== null && (
                <StatusBadge style={getDaysLeftStyle(daysLeft)}>{daysLeft} дней.</StatusBadge>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
