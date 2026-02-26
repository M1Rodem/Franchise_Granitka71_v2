import styles from '@/modules/orders/components/orders-state-view.module.css';
import { motion } from 'framer-motion';

interface OrdersStateViewProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function OrdersStateView({ title, message, actionLabel, onAction }: OrdersStateViewProps) {
  return (
    <motion.section
      className={`glass-card ${styles.state}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </motion.section>
  );
}