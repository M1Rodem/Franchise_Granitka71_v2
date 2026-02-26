import { memo } from 'react';
import styles from '@/modules/orders/components/orders-pagination.module.css';

interface OrdersPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
}

export const OrdersPagination = memo(function OrdersPagination({
  page,
  totalPages,
  totalCount,
  isFetching,
  onPageChange,
}: OrdersPaginationProps) {
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className={styles.pagination}>
      <p className={styles.meta}>Всего: {totalCount}</p>
      <div className={styles.controls}>
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={!canGoPrev || isFetching}>
          Назад
        </button>
        <span>
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={!canGoNext || isFetching}>
          Вперед
        </button>
      </div>
    </div>
  );
});