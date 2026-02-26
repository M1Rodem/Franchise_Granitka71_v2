import styles from '@/modules/orders/components/orders-state-view.module.css';

interface OrdersStateViewProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function OrdersStateView({ title, message, actionLabel, onAction }: OrdersStateViewProps) {
  return (
    <section className={`glass-card ${styles.state}`}>
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}