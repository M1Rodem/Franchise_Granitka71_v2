import { useEffect, useRef } from 'react';
import { OrdersDateInput } from '@/modules/orders/components/OrdersDateInput';
import type { OrdersFilterParams, PlotFilterOption } from '@/modules/orders/types/orders.types';
import styles from '@/modules/orders/components/orders-filter-bar.module.css';
import { motion } from 'framer-motion';
import { AnimatedSelect } from '@/shared/ui/AnimatedSelect'
import button from '@/shared/ui/button.module.css'

interface OrdersFilterBarProps {
  filters: OrdersFilterParams;
  plots: PlotFilterOption[];
  isFetching: boolean;
  onFiltersChange: (patch: Partial<OrdersFilterParams>) => void;
  onReset: () => void;
}

const paymentOptions = [
  { value: '', label: 'Оплата: все' },
  { value: '1', label: 'Аванс' },
  { value: '2', label: 'Частично оплачен' },
  { value: '3', label: 'Оплачен' },
];

const completionOptions = [
  { value: '', label: 'Выполнение: все' },
  { value: '0', label: 'Новый' },
  { value: '1', label: 'В работе' },
  { value: '2', label: 'Оплата' },
  { value: '3', label: 'Готов' },
  { value: '4', label: 'Доставлен' },
];

const parseNullableInt = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export function OrdersFilterBar({
  filters,
  plots,
  isFetching,
  onFiltersChange,
  onReset,
}: OrdersFilterBarProps) {
  const debounceRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) {
      return;
    }

    if (document.activeElement !== input && input.value !== filters.searchQuery) {
      input.value = filters.searchQuery;
    }
  }, [filters.searchQuery]);

  return (
    <div className={styles.form}>
      <div className={styles.searchRow}>
        <input
          ref={searchInputRef}
          type="search"
          defaultValue={filters.searchQuery}
          onChange={(event) => {
            if (debounceRef.current !== null) {
              window.clearTimeout(debounceRef.current);
            }

            const value = event.target.value;
            debounceRef.current = window.setTimeout(() => {
              onFiltersChange({ searchQuery: value });
            }, 350);
          }}
          className={styles.searchInput}
          placeholder="Поиск: номер, телефон, клиент или менеджер"
        />
        <button type="button" className={`${button.btn} ${button.btnSecondary}`} onClick={onReset} disabled={isFetching}>
          Сброс
        </button>
      </div>

      <motion.div
        className={styles.filtersGrid}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <OrdersDateInput
          label="Дата от"
          isoValue={filters.dateFrom}
          onCommit={(isoDate) => onFiltersChange({ dateFrom: isoDate })}
        />

        <OrdersDateInput
          label="Дата до"
          isoValue={filters.dateTo}
          onCommit={(isoDate) => onFiltersChange({ dateTo: isoDate })}
        />

        <label>
          <span>Участок</span>
          <AnimatedSelect
            value={String(filters.plotId ?? '')}
            options={[
              { value: '', label: 'Все участки' },
              ...plots.map(plot => ({
                value: String(plot.id),
                label: plot.name,
              })),
            ]}
            onChange={(val) =>
              onFiltersChange({ plotId: parseNullableInt(val) })
            }
          />
        </label>

        <label>
          <span>Статус оплаты</span>
          <AnimatedSelect
            value={String(filters.paymentStatus ?? '')}
            options={paymentOptions}
            onChange={(val) =>
              onFiltersChange({ paymentStatus: parseNullableInt(val) })
            }
          />
        </label>

        <label>
          <span>Статус выполнения</span>
          <AnimatedSelect
            value={String(filters.completionStatus ?? '')}
            options={completionOptions}
            onChange={(val) =>
              onFiltersChange({ completionStatus: parseNullableInt(val) })
            }
          />
        </label>
      </motion.div>
    </div>
  );
}