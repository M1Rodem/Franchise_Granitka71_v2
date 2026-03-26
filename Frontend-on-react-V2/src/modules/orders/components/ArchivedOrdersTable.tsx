import table from '@/shared/ui/table-base.module.css';
import { StatusBadge } from '@/shared/ui/status';
import type { OrderResponseDto } from '@/modules/orders/types/orders.types';
import { formatPhone } from '@/shared/lib/phone';
import { getPaymentStatusInfo } from '@/modules/orders/lib/payment-status';

interface ArchivedOrdersTableProps {
  orders: OrderResponseDto[];
  onOpenOrder: (id: number) => void;
}

const statusLabels: Record<number, string> = {
  0: 'Новый',
  1: 'В работе',
  2: 'Оплата',
  3: 'Готов',
  4: 'Доставлен',
};

function getDaysLeft(deletedAt?: string | null) {
  if (!deletedAt) return null;

  const deletedDate = new Date(deletedAt).getTime();
  const now = Date.now();

  const diffDays = Math.floor((now - deletedDate) / 86400000);
  const daysLeft = 14 - diffDays;

  return daysLeft;
}

function getDaysLeftStyle(daysLeft: number | null) {
  if (daysLeft === null) return {};

  if (daysLeft < 3) {
    return {
      background: 'rgba(255,99,99,0.2)',
      border: '1px solid rgba(255,120,120,0.5)',
      color: '#ffdede',
    };
  }

  if (daysLeft <= 7) {
    return {
      background: 'rgba(255,180,0,0.2)',
      border: '1px solid rgba(255,200,80,0.5)',
      color: '#fff3d4',
    };
  }

  return {
    background: 'rgba(120,200,255,0.2)',
    border: '1px solid rgba(150,210,255,0.5)',
    color: '#e6f5ff',
  };
}

const GRID_TEMPLATE = '110px 1.4fr 150px 130px 130px 140px 160px 1fr 1fr';

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

        const status =
          typeof order.status === 'number'
            ? (statusLabels[order.status] ?? `Статус ${order.status}`)
            : order.status;

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

            <span data-label="Статус">{status}</span>

            <span data-label="Оплата">
              <StatusBadge style={paymentStatusInfo.style}>{paymentStatusInfo.label}</StatusBadge>
            </span>

            <span data-label="Участок" className={table.primaryCell}>
              {order.plotName || '-'}
            </span>

            <span data-label="До удаления">
              {daysLeft !== null && (
                <StatusBadge style={getDaysLeftStyle(daysLeft)}>{daysLeft} РґРЅ.</StatusBadge>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
