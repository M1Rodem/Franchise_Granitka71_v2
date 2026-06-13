import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useOfflineOrders } from '@/modules/offline/hooks/use-offline-orders'
import { offlineSyncService } from '@/modules/offline/sync/offline-sync.service'

import { useConnectivity } from '../hooks/use-connectivity'
import { AdminSyncModal } from '../components/AdminSyncModal'

import { StatusBadge } from '@/shared/ui/status/StatusBadge'

import { getOfflineStatusInfo } from '../lib/offline-status-info'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import buttons from '@/shared/ui/button.module.css'

import styles from './offline-orders-page.module.css'

const GRID_TEMPLATE =
  '220px 220px 90px 90px 220px 1fr'

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU')
}

export default function OfflineOrdersPage() {
  const { items, isLoading } = useOfflineOrders()
  const { isOnline } = useConnectivity()

  const navigate = useNavigate()

  const [isSyncing] = useState(false)

  const [syncModalOpen, setSyncModalOpen] =
    useState(false)

  const [groupedOrders, setGroupedOrders] = useState<
    Array<{
      userId: number
      fullName: string
      count: number
    }>
  >([])

  useEffect(() => {
    const loadGrouped = async () => {
      const grouped =
        await offlineSyncService.getOrdersGroupedByOwner()

      setGroupedOrders(grouped)
    }

    void loadGrouped()
  }, [items])

  return (
    <>
      <div
        className={surface.surface}
        style={{ marginBottom: '24px' }}
      >
        <div
          className={styles.header}
          style={{ flexDirection: 'row-reverse' }}
        >
          <button
            type="button"
            disabled={
              !isOnline ||
              isSyncing ||
              groupedOrders.length === 0
            }
            onClick={() => setSyncModalOpen(true)}
            className={`${buttons.btn} ${buttons.btnWarning}`}
          >
            {isSyncing
              ? 'Синхронизация...'
              : isOnline
                ? groupedOrders.length > 0
                  ? 'Синхронизировать'
                  : 'Нет заказов'
                : 'Нет соединения'}
          </button>
        </div>

        {groupedOrders.length > 0 && isOnline && (
          <>
            <div className={surface.diffGroupTitle}>
              Доступно для синхронизации
            </div>

            <div className={styles.syncBlock}>
              {groupedOrders.map((group) => (
                <div
                  key={group.userId}
                  className={styles.syncRow}
                >
                  <span className={styles.syncName}>
                    {group.fullName}
                  </span>

                  <span className={styles.syncCount}>
                    {group.count} заказ(ов)
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={surface.surface}>
        <div
          className={table.dataHeader}
          style={{
            gridTemplateColumns: GRID_TEMPLATE,
          }}
        >
          <span>Номер</span>
          <span>Создан</span>
          <span>Фото</span>
          <span>Видео</span>
          <span>Статус</span>
          <span>Владелец</span>
        </div>

        {isLoading ? (
          <div className={table.empty}>
            Загрузка...
          </div>
        ) : items.length === 0 ? (
          <div className={table.empty}>
            Нет оффлайн заказов
          </div>
        ) : (
          items.map((item) => {
            const statusInfo =
              getOfflineStatusInfo(item.status)

            return (
              <div
                key={item.localId}
                onClick={() =>
                  navigate(`/offline-orders/${item.localId}`)
                }
                className={`${table.dataRow} ${table.selectableRow} ${styles.clickableRow}`}
                style={{
                  gridTemplateColumns: GRID_TEMPLATE,
                }}
              >
                <span data-label="Номер">
                  {item.clientGeneratedId}
                </span>

                <span data-label="Создан">
                  {formatDate(item.createdAt)}
                </span>

                <span data-label="Фото">
                  {item.photoCount}
                </span>

                <span data-label="Видео">
                  {item.videoCount}
                </span>

                <span data-label="Статус">
                  <StatusBadge style={statusInfo.style}>
                    {statusInfo.label}
                  </StatusBadge>
                </span>

                <span data-label="Владелец">
                  {item.ownerFullName}
                </span>
              </div>
            )
          })
        )}
      </div>

        <AdminSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSyncSuccess={async () => {
          const grouped =
            await offlineSyncService.getOrdersGroupedByOwner()

          setGroupedOrders(grouped)

          window.location.reload()
        }}
        groupedOrders={groupedOrders}
      />
    </>
  )
}