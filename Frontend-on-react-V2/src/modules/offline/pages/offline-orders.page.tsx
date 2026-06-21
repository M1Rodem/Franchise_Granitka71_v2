import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useOfflineOrders } from '@/modules/offline/hooks/use-offline-orders'
import { offlineSyncService } from '@/modules/offline/sync/offline-sync.service'

import { useConnectivity } from '../hooks/use-connectivity'
import { AdminSyncModal } from '../components/AdminSyncModal'

import { StatusBadge } from '@/shared/ui/status/StatusBadge'
import { getOfflineStatusInfo } from '../lib/offline-status-info'
import { useAuthStore } from '@/shared/store/auth.store'
import { showTempMessage } from '@/shared/ui/temp-message.service'

import surface from '@/shared/ui/surface.module.css'
import table from '@/shared/ui/table-base.module.css'
import buttons from '@/shared/ui/button.module.css'
import toolbar from '@/shared/ui/page-toolbar.module.css'
import styles from './offline-orders-page.module.css'

const GRID_TEMPLATE = '220px 220px 90px 90px 220px 1fr'

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU')
}

export default function OfflineOrdersPage() {
  const { items, isLoading } = useOfflineOrders()
  const { isOnline } = useConnectivity()
  const navigate = useNavigate()

  const [isSyncing, setIsSyncing] = useState(false)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [groupedOrders, setGroupedOrders] = useState<
    Array<{ userId: number; fullName: string; count: number }>
  >([])

  // Прогресс синхронизации
  const [syncProgress, setSyncProgress] = useState<{
    current: number
    total: number
    status: 'idle' | 'in-progress' | 'complete' | 'error'
  }>({
    current: 0,
    total: 0,
    status: 'idle'
  })

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    const loadGrouped = async () => {
      const grouped = await offlineSyncService.getOrdersGroupedByOwner()
      setGroupedOrders(grouped)
    }
    void loadGrouped()
  }, [items])

  const handleSync = async () => {
    // Если авторизован → синхронизируем без модалки
    if (isAuthenticated && token && user) {
      setIsSyncing(true)
      
      // Инициализируем прогресс
      const totalOrders = groupedOrders.reduce((sum, g) => sum + g.count, 0)
      setSyncProgress({
        current: 0,
        total: totalOrders,
        status: 'in-progress'
      })

      try {
        const results = await offlineSyncService.syncUserOrders(
          user.id,
          token,
          (current, total) => {
            setSyncProgress({
              current,
              total,
              status: 'in-progress'
            })
          }
        )

        if (results.failed === 0) {
          setSyncProgress({
            current: results.total,
            total: results.total,
            status: 'complete'
          })
          showTempMessage('success', `Синхронизировано ${results.success} заказов`)
          const grouped = await offlineSyncService.getOrdersGroupedByOwner()
          setGroupedOrders(grouped)
          
          // Задержка перед перезагрузкой, чтобы пользователь увидел 100%
          setTimeout(() => {
            window.location.reload()
          }, 500)
        } else {
          setSyncProgress({
            current: results.success,
            total: results.total,
            status: 'error'
          })
          showTempMessage(
            'warning',
            `Синхронизировано ${results.success} из ${results.total}. Ошибок: ${results.failed}`
          )
          setIsSyncing(false)
        }
      } catch (error) {
        console.error('Sync failed:', error)
        setSyncProgress({
          current: 0,
          total: 0,
          status: 'error'
        })
        showTempMessage('error', 'Ошибка при синхронизации')
        setIsSyncing(false)
      }
      return
    }

    // Не авторизован → показываем модалку
    setSyncModalOpen(true)
  }

  // Расчет процента для прогресс-бара
  const progressPercent = syncProgress.total > 0
    ? Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100))
    : 0

  return (
    <>
      <div className={surface.surface} style={{ marginBottom: '24px' }}>
        <p className={toolbar.description}>
                Управляйте сотрудниками и системными сущностями из единой
                административной панели.
        </p>
        <div className={styles.header} style={{ flexDirection: 'row-reverse' }}>
          <button
            type="button"
            disabled={!isOnline || isSyncing || groupedOrders.length === 0}
            onClick={handleSync}
            className={`${buttons.btn} ${buttons.btnWarning}`}
          >
            {isSyncing
              ? `${progressPercent}%`
              : isOnline
                ? groupedOrders.length > 0
                  ? 'Синхронизировать'
                  : 'Нет заказов'
                : 'Нет соединения'}
          </button>
        </div>

        {/* Прогресс-бар синхронизации */}
        {isSyncing && syncProgress.total > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginBottom: '6px'
            }}>
              <span>Синхронизация заказов</span>
              <span>{syncProgress.current} из {syncProgress.total}</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              background: 'var(--tone-rgb-255-255-255-09)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100
                  ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                  : 'linear-gradient(90deg, #eab308, #f59e0b)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            {syncProgress.status === 'error' && (
              <div style={{
                fontSize: '12px',
                color: 'var(--text-danger-soft)',
                marginTop: '6px'
              }}>
                Некоторые заказы не синхронизировались
              </div>
            )}
          </div>
        )}

        {groupedOrders.length > 0 && isOnline && (
          <>
            <div className={surface.diffGroupTitle}>Доступно для синхронизации</div>
            <div className={styles.syncBlock}>
              {groupedOrders.map((group) => (
                <div key={group.userId} className={styles.syncRow}>
                  <span className={styles.syncName}>{group.fullName}</span>
                  <span className={styles.syncCount}>{group.count} заказ(ов)</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={surface.surface}>
        <div
          className={table.dataHeader}
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          <span>Номер</span>
          <span>Создан</span>
          <span>Фото</span>
          <span>Видео</span>
          <span>Статус</span>
          <span>Владелец</span>
        </div>

        {isLoading ? (
          <div className={table.empty}>Загрузка...</div>
        ) : items.length === 0 ? (
          <div className={table.empty}>Нет оффлайн заказов</div>
        ) : (
          items.map((item) => {
            const statusInfo = getOfflineStatusInfo(item.status)
            return (
              <div
                key={item.localId}
                onClick={() => navigate(`/offline-orders/${item.localId}`)}
                className={`${table.dataRow} ${table.selectableRow} ${styles.clickableRow}`}
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <span data-label="Номер">{item.displayId}</span>
                <span data-label="Создан">{formatDate(item.createdAt)}</span>
                <span data-label="Фото">{item.photoCount}</span>
                <span data-label="Видео">{item.videoCount}</span>
                <span data-label="Статус">
                  <StatusBadge style={statusInfo.style}>{statusInfo.label}</StatusBadge>
                </span>
                <span data-label="Владелец">{item.ownerFullName}</span>
              </div>
            )
          })
        )}
      </div>

      <AdminSyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSyncSuccess={async () => {
          const grouped = await offlineSyncService.getOrdersGroupedByOwner()
          setGroupedOrders(grouped)
          window.location.reload()
        }}
        groupedOrders={groupedOrders}
      />
    </>
  )
}