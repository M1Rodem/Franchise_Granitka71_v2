import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrdersFilterBar } from '@/modules/orders/components/OrdersFilterBar';
import { OrdersPagination } from '@/modules/orders/components/OrdersPagination';
import { OrdersStateView } from '@/modules/orders/components/OrdersStateView';
import { OrdersTable } from '@/modules/orders/components/OrdersTable';
import { OrdersTableSkeleton } from '@/modules/orders/components/OrdersTableSkeleton';
import { useOrdersFilterOptions } from '@/modules/orders/hooks/use-orders-filter-options';
import { useOrdersFilters } from '@/modules/orders/hooks/use-orders-filters';
import { useOrdersList } from '@/modules/orders/hooks/use-orders-list';
import type { OrdersFilterParams } from '@/modules/orders/types/orders.types';
import styles from '@/modules/orders/pages/orders-list.page.module.css';
import { AnimatePresence, motion } from 'framer-motion';

export default function OrdersListPage() {
  const navigate = useNavigate();
  const { filters, queryParams, setPage, patchFilterParams, resetFilters } = useOrdersFilters();

  const plotsQuery = useOrdersFilterOptions();
  const ordersQuery = useOrdersList(queryParams);

  const openOrder = useCallback(
    (id: number) => {
      navigate(`/orders/${id}`);
    },
    [navigate],
  );

  const onFiltersChange = useCallback(
    (patch: Partial<OrdersFilterParams>) => patchFilterParams(patch),
    [patchFilterParams],
  );

  return (
    <section className={styles.page}>
      <div className={`glass-card ${styles.toolbar}`}>
        <OrdersFilterBar
          filters={filters}
          plots={plotsQuery.data ?? []}
          isFetching={ordersQuery.isFetching}
          onFiltersChange={onFiltersChange}
          onReset={resetFilters}
        />
      </div>

      {ordersQuery.isPending && <OrdersTableSkeleton />}

      {ordersQuery.isError && (
        <OrdersStateView
          title="Ошибка загрузки"
          message="Не удалось загрузить список заказов. Проверьте соединение и повторите попытку."
          actionLabel="Повторить"
          onAction={() => {
            void ordersQuery.refetch();
          }}
        />
      )}

      {!ordersQuery.isPending && !ordersQuery.isError && ordersQuery.data.items.length === 0 && (
        <OrdersStateView
          title="Заказы не найдены"
          message="По текущим фильтрам нет записей. Измените параметры или сбросьте фильтр."
        />
      )}

      {!ordersQuery.isPending && !ordersQuery.isError && ordersQuery.data.items.length > 0 && (
        <AnimatePresence mode="wait">
          {!ordersQuery.isPending &&
            !ordersQuery.isError &&
            ordersQuery.data.items.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                <OrdersStateView
                  title="Заказы не найдены"
                  message="По текущим фильтрам нет записей. Измените параметры или сбросьте фильтр."
                />
              </motion.div>
            )}

          {!ordersQuery.isPending &&
            !ordersQuery.isError &&
            ordersQuery.data.items.length > 0 && (
              <motion.div
                key="table"
                className={styles.results}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <OrdersTable orders={ordersQuery.data.items} onOpenOrder={openOrder} />
                <OrdersPagination
                  page={ordersQuery.data.page}
                  totalPages={ordersQuery.data.totalPages}
                  totalCount={ordersQuery.data.totalCount}
                  isFetching={ordersQuery.isFetching}
                  onPageChange={setPage}
                />
              </motion.div>
            )}
        </AnimatePresence>
      )}
    </section>
  );
}
