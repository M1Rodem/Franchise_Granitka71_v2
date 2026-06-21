import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useOfflineOrder } from '@/modules/offline/hooks/useOfflineOrder'
import { useAuthStore } from '@/shared/store/auth.store'
import { showTempMessage } from '@/shared/ui/temp-message.service'
import { offlineRepository } from '@/modules/offline/repositories/offline.repository'
import { offlineMediaRepository } from '@/modules/offline/repositories/offline-media.repository'
import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'
import { offlinePlotsService } from '@/modules/offline/services/offline-plots.service'
import { useConnectivity } from '@/modules/offline/hooks/use-connectivity'

// Компоненты для отображения
import { ClientSection } from '@/modules/orders/components/order-details/ClientSection'
import { DeceasedSection } from '@/modules/orders/components/order-details/DeceasedSection'
import { MonumentSection } from '@/modules/orders/components/order-details/MonumentSection'
import { MetadataSection } from '@/modules/orders/components/order-details/MetadataSection'
import { InstallationSection } from '@/modules/orders/components/order-details/InstallationSection'
import { WorksSection } from '@/modules/orders/components/order-details/WorksSection'
import { PaymentsSection } from '@/modules/orders/components/order-details/PaymentsSection'
import { FinancialSection } from '@/modules/orders/components/order-details/FinancialSection'
import { AdditionalInfoSection } from '@/modules/orders/components/order-details/AdditionalInfoSection'
import { AppIcon } from '@/shared/ui/AppIcon'

import styles from './offline-order-details.module.css'

// Вспомогательная функция для конвертации OfflineOrder в формат для компонентов
function mapOfflineOrderToDetails(order: any) {
  const workItems = order.payload.workItems.map((w: any, index: number) => ({
    id: index,
    workDescription: w.workDescription,
    price: w.price,
    quantity: w.quantity ?? 0,
    routes: w.routes ?? 1,
    distanceKm: w.distanceKm,
    isDistanceWork: w.isDistanceWork ?? false,
    note: w.note,
  }))

  const payments = order.payload.payments.map((p: any, index: number) => ({
    id: index,
    amount: p.amount,
    paymentDate: p.paymentDate,
    paymentType: p.paymentType,
    note: p.note,
  }))

  const subtotal = workItems.reduce((sum: number, w: any) => {
    if (w.isDistanceWork) {
      const km = w.distanceKm || 0
      const routes = w.routes || 1
      return sum + w.price * km * routes
    }
    return sum + w.price * (w.quantity || 0)
  }, 0)

  const discountAmount = subtotal * ((order.payload.discountPercent || 0) / 100)
  const totalPrice = subtotal - discountAmount
  const paid = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
  const paymentStatus = paid >= totalPrice ? 2 : paid > 0 ? 1 : 0

  return {
    id: order.localId,
    orderNumber: order.displayId,
    place: order.payload.place,
    inspectionPlace: order.payload.inspectionPlace,
    orderDate: order.createdAt,
    latitude: order.payload.latitude,
    longitude: order.payload.longitude,
    plotId: order.payload.plotId,
    plotName: null,
    deceasedFullName: order.payload.deceasedFullName,
    customerFullName: order.payload.customerFullName,
    customerEmail: order.payload.customerEmail,
    phone: order.payload.phone,
    address: order.payload.address,
    monumentType: order.payload.monumentType,
    monumentSize: order.payload.monumentSize,
    additionalInfo: order.payload.additionalInfo,
    status: 0,
    subtotal,
    discountPercent: order.payload.discountPercent || 0,
    discountAmount,
    totalPrice,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    managerId: order.ownerUserId,
    managerFullName: order.ownerFullName,
    workItems,
    payments,
    photos: [],
    completion: null,
    isDeleted: false,
    deletedAt: null,
    paymentStatus,
  }
}

export default function OfflineOrderDetailsPage() {
  const { localId } = useParams<{ localId: string }>()
  const navigate = useNavigate()
  const { order, isLoading, error } = useOfflineOrder(localId)
  const { isOnline } = useConnectivity()
  const currentUser = useAuthStore((state) => state.user)
  
  // Проверка прав на удаление:
  // 1. Только в онлайне
  // 2. Admin или SuperAdmin
  // 3. ИЛИ владелец заказа (авторизованный пользователь)
  const canDelete = isOnline && order && (
    currentUser?.role === 'Admin' || 
    currentUser?.role === 'SuperAdmin' ||
    currentUser?.id === order.ownerUserId
  )
  
  const [plotCoordinates, setPlotCoordinates] = useState<[number, number] | null>(null)
  const [destinationCoordinates, setDestinationCoordinates] = useState<[number, number] | null>(null)
  const [plotName, setPlotName] = useState<string | null>(null)

  // Загружаем координаты участка и точки назначения
  useEffect(() => {
    if (!order) return

    const loadCoordinates = async () => {
      // Координаты назначения из заказа
      const lat = order.payload.latitude
      const lng = order.payload.longitude
      if (lat && lng) {
        setDestinationCoordinates([lat, lng])
      }

      // Координаты и название участка по plotId
      const plotId = order.payload.plotId
      if (plotId) {
        const plots = await offlinePlotsService.getCachedPlots()
        const plot = plots.find(p => p.id === plotId)
        if (plot) {
          setPlotCoordinates([plot.latitude, plot.longitude])
          setPlotName(plot.name)
        } else {
          setPlotName(`Участок №${plotId}`)
        }
      }
    }
    loadCoordinates()
  }, [order])

  const handleDelete = async () => {
    if (!order) return

    const confirmed = confirm(`Удалить заказ ${order.displayId}?`)
    if (!confirmed) return

    try {
      const media = await offlineMediaRepository.getOrderMedia(order.localId)
      for (const item of media) {
        await offlineMediaRepository.deleteOrderMedia(item.id)
      }

      await offlineRepository.deleteOfflineOrder(order.localId)

      showTempMessage('success', 'Заказ удален')
      navigate('/offline-orders')
    } catch (err) {
      console.error('Delete failed:', err)
      showTempMessage('error', 'Ошибка при удалении заказа')
    }
  }

  if (isLoading) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.loader}>Загрузка заказа...</div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className={styles.stateContainer}>
        <div className={styles.error}>Ошибка загрузки заказа</div>
        <button onClick={() => navigate('/offline-orders')} className={styles.backButton}>
          <span className={styles.backIcon}>
            <AppIcon name="arrowLeft" />
          </span>
          Назад к списку
        </button>
      </div>
    )
  }

  const details = mapOfflineOrderToDetails(order)

  // Подсказка для disabled кнопки
  const getDeleteButtonTitle = () => {
    if (!isOnline) return 'Удаление доступно только при наличии интернета'
    if (!canDelete) return 'Вы можете удалять только свои заказы'
    return ''
  }

  return (
    <div className={styles.page}>
      <ClientSection
        fullName={details.customerFullName}
        email={details.customerEmail}
        phone={details.phone}
        address={details.address}
      />

      <DeceasedSection deceasedFullName={details.deceasedFullName} />

      <MonumentSection type={details.monumentType || ''} size={details.monumentSize || ''} />

      <MetadataSection
        manager={details.managerFullName}
        orderDate={details.orderDate}
        updatedAt={details.updatedAt}
        dateOnly
      />

      <InstallationSection
        plotName={plotName}
        place={details.place}
        inspectionPlace={details.inspectionPlace}
        latitude={details.latitude}
        longitude={details.longitude}
        distanceKm={null}
        plotCoordinates={plotCoordinates}
        destinationCoordinates={destinationCoordinates}
      />

      <WorksSection items={details.workItems} />

      <FinancialSection
        subtotal={details.subtotal}
        discountPercent={details.discountPercent}
        discountAmount={details.discountAmount}
        totalPrice={details.totalPrice}
        payments={details.payments}
        paymentStatus={details.paymentStatus}
      />

      <PaymentsSection items={details.payments} />

      {order.media.length > 0 && (
        <section className={surface.surface}>
          <h2 className={surface.sectionTitle}>Медиафайлы</h2>
          <div className={styles.mediaList}>
            {order.media.map((item) => (
              <div key={item.id} className={styles.mediaItem}>
                {item.type === 'photo' ? (
                  <img
                    src={URL.createObjectURL(item.blob)}
                    alt={item.fileName}
                    className={styles.mediaImage}
                    style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px' }}
                  />
                ) : (
                  <video
                    src={URL.createObjectURL(item.blob)}
                    controls
                    className={styles.mediaVideo}
                    style={{ maxWidth: '200px', maxHeight: '150px' }}
                  />
                )}
                <div className={styles.mediaFileName}>{item.fileName}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AdditionalInfoSection additionalInfo={details.additionalInfo || ''} />

      <div className={styles.actions}>
        <button
          type="button"
          className={button.btn}
          onClick={() => navigate('/offline-orders')}
        >
          Назад к списку
        </button>

        {!canDelete ? (
          <span title={getDeleteButtonTitle()} style={{ display: 'inline-block' }}>
            <button
              type="button"
              className={`${button.btn} ${button.btnDanger}`}
              disabled={true}
              style={{ cursor: 'not-allowed' }}
            >
              Удалить заказ
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={`${button.btn} ${button.btnDanger}`}
            onClick={handleDelete}
          >
            Удалить заказ
          </button>
        )}
      </div>
    </div>
  )
}