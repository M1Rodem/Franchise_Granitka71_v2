import { useNavigate } from 'react-router-dom'
import { ArchivedOrdersTable } from '@/modules/orders/components/ArchivedOrdersTable'
import { OrdersPagination } from '@/modules/orders/components/OrdersPagination'
import { OrdersFilterBar } from '@/modules/orders/components/OrdersFilterBar'
import { useOrdersFilters } from '@/modules/orders/hooks/use-orders-filters'
import { useOrdersFilterOptions } from '@/modules/orders/hooks/use-orders-filter-options'
import { useArchivedOrders } from '@/modules/orders/hooks/use-archived-orders'
import { OrdersTableSkeleton } from '@/modules/orders/components/OrdersTableSkeleton'
import surface from '@/shared/ui/surface.module.css'
import toolbar from '@/shared/ui/page-toolbar.module.css'
import styles from './archived-orders.page.module.css'

export default function ArchivedOrdersPage() {
  const navigate = useNavigate()

  const {
    filters,
    queryParams,
    setPage,
    patchFilterParams,
    resetFilters
  } = useOrdersFilters()

  const plotsQuery = useOrdersFilterOptions()
  const ordersQuery = useArchivedOrders(queryParams)

  const openOrder = (id: number) => {
    navigate(`/orders/archived/${id}`)
  }

  return (
    <div className={styles.page}>
      <section className={`${surface.surface} ${styles.filterSurface}`}>
        <div className={toolbar.shell}>
          <div className={toolbar.row}>
            <div className={toolbar.titleBlock}>
              <span className={toolbar.eyebrow}>Archive</span>
              <h1 className={toolbar.heading}>Архив заказов</h1>
              <p className={toolbar.description}>
                Удалённые заказы временно хранятся в архиве, чтобы их можно было
                быстро найти и проверить.
              </p>
            </div>

            <div className={toolbar.meta}>
              <span className={toolbar.pill}>Хранение 14 дней</span>
              <span className={toolbar.pill}>Быстрый поиск</span>
            </div>
          </div>

          <div className={styles.helper}>
            Удалённые заказы перемещаются в архив и хранятся 14 дней.
            После этого они удаляются окончательно.
          </div>
        </div>

        <OrdersFilterBar
          filters={filters}
          plots={plotsQuery.data ?? []}
          isFetching={ordersQuery.isFetching}
          onFiltersChange={patchFilterParams}
          onReset={resetFilters}
        />
      </section>

      {ordersQuery.isPending && <OrdersTableSkeleton />}

      {ordersQuery.isError && (
        <div className={surface.surface}>
          Ошибка загрузки архивных заказов
        </div>
      )}

      {ordersQuery.data && (
        <>
          <ArchivedOrdersTable
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
        </>
      )}
    </div>
  )
}
