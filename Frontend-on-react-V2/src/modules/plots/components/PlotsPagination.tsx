import { memo } from 'react'
import styles from '@/modules/orders/components/orders-pagination.module.css'
import button from '@/shared/ui/button.module.css'

interface PlotsPaginationProps {
  page: number
  totalPages: number
  totalCount: number
  isFetching: boolean
  onPageChange: (page: number) => void
}

export const PlotsPagination = memo(function PlotsPagination({
  page,
  totalPages,
  totalCount,
  isFetching,
  onPageChange,
}: PlotsPaginationProps) {

  const canGoPrev = page > 1
  const canGoNext = page < totalPages

  return (
    <div className={styles.pagination}>
      <p className={styles.meta}>
        Всего: {totalCount}
      </p>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${button.btn} ${button.btnPrimary}`}
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrev || isFetching}
        >
          Назад
        </button>

        <span>
          {page} / {Math.max(totalPages, 1)}
        </span>

        <button
          type="button"
          className={`${button.btn} ${button.btnPrimary}`}
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext || isFetching}
        >
          Вперед
        </button>
      </div>
    </div>
  )
})