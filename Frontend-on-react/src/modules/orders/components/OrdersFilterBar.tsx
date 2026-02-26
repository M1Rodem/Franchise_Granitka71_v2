import { useEffect, useRef } from 'react';
import { OrdersDateInput } from '@/modules/orders/components/OrdersDateInput';
import type { OrdersFilterParams, PlotFilterOption } from '@/modules/orders/types/orders.types';
import styles from '@/modules/orders/components/orders-filter-bar.module.css';

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
        <button type="button" className={styles.clearButton} onClick={onReset} disabled={isFetching}>
          Сброс
        </button>
      </div>

      <div className={styles.filtersGrid}>
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
          <select
            value={filters.plotId ?? ''}
            onChange={(event) => onFiltersChange({ plotId: parseNullableInt(event.target.value) })}
          >
            <option value="">Все участки</option>
            {plots.map((plot) => (
              <option key={plot.id} value={plot.id}>
                {plot.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Статус оплаты</span>
          <select
            value={filters.paymentStatus ?? ''}
            onChange={(event) => onFiltersChange({ paymentStatus: parseNullableInt(event.target.value) })}
          >
            {paymentOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Статус выполнения</span>
          <select
            value={filters.completionStatus ?? ''}
            onChange={(event) => onFiltersChange({ completionStatus: parseNullableInt(event.target.value) })}
          >
            {completionOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}