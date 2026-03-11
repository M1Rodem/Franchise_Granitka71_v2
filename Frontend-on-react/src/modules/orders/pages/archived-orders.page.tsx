import { useNavigate } from 'react-router-dom'
import { ArchivedOrdersTable } from '@/modules/orders/components/ArchivedOrdersTable'
import { OrdersPagination } from '@/modules/orders/components/OrdersPagination'
import { OrdersFilterBar } from '@/modules/orders/components/OrdersFilterBar'
import { useOrdersFilters } from '@/modules/orders/hooks/use-orders-filters'
import { useOrdersFilterOptions } from '@/modules/orders/hooks/use-orders-filter-options'
import { useArchivedOrders } from '@/modules/orders/hooks/use-archived-orders'
import surface from '@/shared/ui/surface.module.css'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <section className={surface.surface}>
        <p>
          Удалённые заказы перемещаются в архив и хранятся 14 дней.
          После этого они удаляются окончательно.
        </p>
      </section>

      <section className={surface.surface}>
        <OrdersFilterBar
          filters={filters}
          plots={plotsQuery.data ?? []}
          isFetching={ordersQuery.isFetching}
          onFiltersChange={patchFilterParams}
          onReset={resetFilters}
        />
      </section>

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