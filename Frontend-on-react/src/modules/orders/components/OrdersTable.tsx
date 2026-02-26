import { memo, useMemo } from 'react';
import type { OrderResponseDto } from '@/modules/orders/types/orders.types';
import styles from '@/modules/orders/components/orders-table.module.css';

interface OrdersTableProps {
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

const paymentStatusLabels: Record<number, string> = {
  0: 'Все',
  1: 'Аванс',
  2: 'Частично оплачен',
  3: 'Оплачен',
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

interface OrdersTableRowProps {
  order: OrderResponseDto;
  onOpenOrder: (id: number) => void;
}

const OrdersTableRow = memo(function OrdersTableRow({ order, onOpenOrder }: OrdersTableRowProps) {
  const completionStatus =
    typeof order.status === 'number' ? statusLabels[order.status] ?? `Статус ${order.status}` : order.status;
  const paymentStatus =
    typeof order.paymentStatus === 'number'
      ? paymentStatusLabels[order.paymentStatus] ?? `Статус ${order.paymentStatus}`
      : (order.paymentStatus ?? '-');

  return (
    <tr className={styles.row} onClick={() => onOpenOrder(order.id)}>
      <td>{order.orderNumber || `#${order.id}`}</td>
      <td>{order.customerFullName || '-'}</td>
      <td>{formatDate(order.createdAt)}</td>
      <td>
        <span className={styles.status}>{completionStatus}</span>
      </td>
      <td>{paymentStatus}</td>
      <td>{order.plotName || '-'}</td>
      <td>{order.managerFullName || '-'}</td>
    </tr>
  );
});

export const OrdersTable = memo(function OrdersTable({ orders, onOpenOrder }: OrdersTableProps) {
  const rows = useMemo(
    () => orders.map((order) => <OrdersTableRow key={order.id} order={order} onOpenOrder={onOpenOrder} />),
    [orders, onOpenOrder],
  );

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Номер / ID</th>
            <th>Клиент</th>
            <th>Дата создания</th>
            <th>Статус выполнения</th>
            <th>Статус оплаты</th>
            <th>Участок</th>
            <th>Менеджер</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
});
