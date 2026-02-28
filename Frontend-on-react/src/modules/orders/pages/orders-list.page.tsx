import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

import surface from '@/shared/ui/surface.module.css'

import { OrdersFilterBar } from '@/modules/orders/components/OrdersFilterBar'
import { OrdersPagination } from '@/modules/orders/components/OrdersPagination'
import { OrdersStateView } from '@/modules/orders/components/OrdersStateView'
import { OrdersTable } from '@/modules/orders/components/OrdersTable'

import { useOrdersFilterOptions } from '@/modules/orders/hooks/use-orders-filter-options'
import { useOrdersFilters } from '@/modules/orders/hooks/use-orders-filters'
import { useOrdersList } from '@/modules/orders/hooks/use-orders-list'
import type { OrdersFilterParams } from '@/modules/orders/types/orders.types'

export default function OrdersListPage() {
  const navigate = useNavigate()
  const { filters, queryParams, setPage, patchFilterParams, resetFilters } = useOrdersFilters()

  const plotsQuery = useOrdersFilterOptions()
  const ordersQuery = useOrdersList(queryParams)

  const openOrder = useCallback(
    (id: number) => {
      navigate(`/orders/${id}`)
    },
    [navigate],
  )

  const onFiltersChange = useCallback(
    (patch: Partial<OrdersFilterParams>) => patchFilterParams(patch),
    [patchFilterParams],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* FILTERS */}
      <section className={surface.surface}
            style={{
            position: 'relative',
            zIndex: 20, // фильтр выше таблицы
          }}>
        <OrdersFilterBar
          filters={filters}
          plots={plotsQuery.data ?? []}
          isFetching={ordersQuery.isFetching}
          onFiltersChange={onFiltersChange}
          onReset={resetFilters}
        />
      </section>

      {/* STATES */}
      {ordersQuery.isPending}

      {ordersQuery.isError && (
        <OrdersStateView
          title="Ошибка загрузки"
          message="Не удалось загрузить список заказов."
          actionLabel="Повторить"
          onAction={() => void ordersQuery.refetch()}
        />
      )}

      {!ordersQuery.isPending &&
        !ordersQuery.isError &&
        ordersQuery.data.items.length === 0 && (
          <OrdersStateView
            title="Заказы не найдены"
            message="По текущим фильтрам нет записей."
          />
        )}

      {!ordersQuery.isPending &&
        !ordersQuery.isError &&
        ordersQuery.data.items.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <OrdersTable
                orders={ordersQuery.data.items}
                onOpenOrder={openOrder}
              />

              <OrdersPagination
                page={ordersQuery.data.page}
                totalPages={ordersQuery.data.totalPages}
                totalCount={ordersQuery.data.totalCount}
                isFetching={ordersQuery.isFetching}
                onPageChange={setPage}
              />
            </motion.div>
          </AnimatePresence>
        )}
    </div>
  )
}