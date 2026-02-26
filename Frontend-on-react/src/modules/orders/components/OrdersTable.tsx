import { memo, useMemo } from 'react';
import type { OrderResponseDto } from '@/modules/orders/types/orders.types';
import styles from '@/modules/orders/components/orders-table.module.css';
import { motion, AnimatePresence } from 'framer-motion';

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

export const OrdersTable = memo(function OrdersTable({ orders, onOpenOrder }: OrdersTableProps) {
  const rows = useMemo(
    () =>
      orders.map((order) => {
        const completionStatus =
          typeof order.status === 'number'
            ? statusLabels[order.status] ?? `Статус ${order.status}`
            : order.status;

        const paymentStatus =
          typeof order.paymentStatus === 'number'
            ? paymentStatusLabels[order.paymentStatus] ?? `Статус ${order.paymentStatus}`
            : order.paymentStatus ?? '-';

        return (
          <motion.tr
            layout
            key={order.id}
            className={styles.row}
            onClick={() => onOpenOrder(order.id)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <td className={styles.colNumber}>{order.orderNumber || `#${order.id}`}</td>
            <td className={styles.colClient}>{order.customerFullName || '-'}</td>
            <td className={styles.colPhone}>{order.phone || '-'}</td>
            <td className={styles.colDate}>{formatDate(order.createdAt)}</td>
            <td className={styles.colStatus}>
              <span className={styles.status}>{completionStatus}</span>
            </td>
            <td className={styles.colPayment}>
              <span
                className={`${styles.paymentBadge} ${
                  paymentStatus === 'Аванс'
                    ? styles.paymentAdvance
                    : paymentStatus === 'Оплачен'
                    ? styles.paymentPaid
                    : paymentStatus === 'Частично оплачен'
                    ? styles.paymentPartial
                    : styles.paymentDefault
                }`}
              >
                {paymentStatus}
              </span>
            </td>
            <td className={styles.colPlot}>{order.plotName || '-'}</td>
            <td className={styles.colManager}>{order.managerFullName || '-'}</td>
          </motion.tr>
        );
      }),
    [orders, onOpenOrder],
  );

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Desktop */}
      <div className={styles.desktop}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colNumber}>Номер</th>
              <th className={styles.colClient}>Клиент</th>
              <th className={styles.colPhone}>Телефон</th>
              <th className={styles.colDate}>Дата</th>
              <th className={styles.colStatus}>Статус</th>
              <th className={styles.colPayment}>Оплата</th>
              <th className={styles.colPlot}>Участок</th>
              <th className={styles.colManager}>Менеджер</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {rows}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className={styles.mobile}>
        {orders.map((order) => {
          const completionStatus =
            typeof order.status === 'number'
              ? statusLabels[order.status] ?? `Статус ${order.status}`
              : order.status;

          const paymentStatus =
            typeof order.paymentStatus === 'number'
              ? paymentStatusLabels[order.paymentStatus] ?? `Статус ${order.paymentStatus}`
              : order.paymentStatus ?? '-';

          return (
            <div
              key={order.id}
              className={styles.card}
              onClick={() => onOpenOrder(order.id)}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardNumber}>
                  {order.orderNumber || `#${order.id}`}
                </span>
                <span className={styles.status}>{completionStatus}</span>
              </div>

              <div className={styles.cardRow}>
                <span className={styles.label}>Клиент:</span>
                <span>{order.customerFullName || '-'}</span>
              </div>

              <div className={styles.cardRow}>
                <span className={styles.label}>Телефон:</span>
                <span>{order.phone || '-'}</span>
              </div>

              <div className={styles.cardRow}>
                <span className={styles.label}>Дата:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>

              <div className={styles.cardRow}>
                <span className={styles.label}>Оплата:</span>
                <span>{paymentStatus}</span>
              </div>

              <div className={styles.cardRow}>
                <span className={styles.label}>Менеджер:</span>
                <span>{order.managerFullName || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
});