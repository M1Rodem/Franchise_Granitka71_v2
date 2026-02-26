import styles from '@/modules/orders/components/orders-table-skeleton.module.css';

export function OrdersTableSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.row} />
      <div className={styles.row} />
      <div className={styles.row} />
      <div className={styles.row} />
      <div className={styles.row} />
    </div>
  );
}