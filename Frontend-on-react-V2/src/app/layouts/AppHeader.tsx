import { useNavigate, useLocation } from 'react-router-dom';
import { routeTitles } from '@/app/router/navigation.config';
import { resolveRouteTitle } from '@/shared/lib/navigation';
import { useUiStore } from '@/shared/store/ui.store';
import styles from '@/app/layouts/app-header.module.css';
import { cn } from '@/shared/lib/cn'
import { useEffect, useState } from 'react'
import { signalRService } from '@/shared/lib/signalr/signalr.service'
import buttonStyles from '@/shared/ui/button.module.css'
import { ordersApi } from '@/modules/orders/api/orders.api'
import { useParams } from 'react-router-dom'
import { tempMessage } from '@/shared/ui/temp-message.service'
import { AppIcon } from '@/shared/ui/AppIcon'
import { PrintTypeModal } from '@/modules/orders/components/PrintTypeModal'
import { PrintWithPhotosModal } from '@/modules/orders/components/PrintWithPhotosModal'
import { useQuery } from '@tanstack/react-query'
import { ordersKeys } from '@/modules/orders/lib/orders.keys'
import type { OrderDetailsDto } from '@/modules/orders/types/orders.types'

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const header = useUiStore((state) => state.header)
  const submitDisabled = header.submitDisabled
  const openPlotCreateModal = useUiStore((state) => state.openPlotCreateModal);
  const [excelModalOpen, setExcelModalOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const defaultTitle = resolveRouteTitle(
    location.pathname,
    routeTitles,
    'Granitka71'
  );

  const [status, setStatus] = useState(
    signalRService.getConnectionStatus()
  )

  const isOrderDetails = header.mode === 'orderDetails';
  const isAdminDetails = header.mode === 'adminDetails';
  const isOrderCreate = header.mode === 'orderCreate';
  const isOrderEdit = header.mode === 'orderEdit';
  const isPlots = header.mode === 'plots'
  const isUsers = header.mode === 'users'

  const [printWithPhotosModalOpen, setPrintWithPhotosModalOpen] = useState(false)
  const [isPrintingWithPhotos, setIsPrintingWithPhotos] = useState(false)

  // Получаем данные заказа для фото
  const { data: orderData } = useQuery<OrderDetailsDto>({
    queryKey: ordersKeys.byId(orderId),
    queryFn: () => ordersApi.getById(orderId),
    enabled: printWithPhotosModalOpen && !!orderId && !isNaN(orderId),
  })

  const handlePrintWithPhotos = async (photoIds: number[], type: 'default' | 'worker') => {
    if (!orderId) {
      tempMessage.error('Не удалось определить ID заказа')
      return
    }

    if (!photoIds.length) {
      tempMessage.warning('Выберите хотя бы одно фото')
      return
    }

    setIsPrintingWithPhotos(true)

    try {
      const blob = await ordersApi.printOrderWithPhotos(orderId, type, photoIds)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      console.error(e)
      tempMessage.error('Ошибка при печати с фото')
    } finally {
      setIsPrintingWithPhotos(false)
      setPrintWithPhotosModalOpen(false)
    }
  }

  useEffect(() => {
    const unsub = signalRService.subscribeStatus((s) => {
      setStatus(s)
    })

    return unsub
  }, [])

  const handleExcelDownload = async (type: 'default' | 'worker') => {
    if (!orderId) {
      tempMessage.error('Не удалось определить ID заказа')
      return
    }

    setIsDownloading(true)

    try {
      const blob = await ordersApi.downloadOrderExcel(orderId, type)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileType = type === 'worker' ? 'worker' : 'order'
      a.download = `${fileType}_${header.orderNumber}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      tempMessage.success(type === 'worker' ? 'Excel для рабочих скачан' : 'Excel скачан')
    } catch (e) {
      console.error(e)
      tempMessage.error('Ошибка при скачивании Excel')
    } finally {
      setIsDownloading(false)
      setExcelModalOpen(false)
    }
  }

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Open menu"
        onClick={openMobileSidebar}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Обычный заголовок */}
      {!isOrderDetails && !isAdminDetails && !isOrderCreate && !isOrderEdit && !isPlots && !isUsers && (
        <h1 className={styles.title}>{defaultTitle}</h1>
      )}

      {/* Режим заказа */}
      {isOrderDetails && (
        <>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={cn(
              buttonStyles.btn,
              buttonStyles.btnNeutral,
              styles.backBtn
            )}
          >
            <span className={styles.backIcon}>
              <AppIcon name="arrowLeft" />
            </span>
            Назад
          </button>

          
          <h1 className={styles.detailsTitle}>
            {header.title} №{header.orderNumber}
          </h1>

          <div className={styles.detailsActions}>
            {/* Кнопка печати с модальным окном */}
            <button
              type="button"
              onClick={() => setPrintWithPhotosModalOpen(true)}
              className={cn(buttonStyles.btn, buttonStyles.btnPrint, buttonStyles.btnWithIcon)}
              disabled={isPrintingWithPhotos}
            >
              <span className={styles.actionIcon}>
                <AppIcon name="print" />
              </span>
              {isPrintingWithPhotos ? 'Загрузка...' : 'Печать'}
            </button>

            {/* Кнопка Excel */}
            <button
              type="button"
              onClick={() => setExcelModalOpen(true)}
              className={cn(buttonStyles.btn, buttonStyles.btnExcel, buttonStyles.btnWithIcon)}
              disabled={isDownloading}
            >
              <span className={styles.actionIcon}>
                <AppIcon name="download" />
              </span>
              {isDownloading ? 'Загрузка...' : 'Excel'}
            </button>
          </div>

          {/* Модальное окно выбора типа печати */}
          <PrintTypeModal
            isOpen={excelModalOpen}
            title="Выберите тип Excel документа"
            onClose={() => setExcelModalOpen(false)}
            onSelect={handleExcelDownload}
            isLoading={isDownloading}
          />
        </>
      )}

      {/* CREATE ORDER MODE */}
      {isOrderCreate && (
        <>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={cn(
              buttonStyles.btn,
              buttonStyles.btnNeutral,
              styles.backBtn
            )}
          >
            <span className={styles.backIcon}>
              <AppIcon name="arrowLeft" />
            </span>
            Назад
          </button>

          <div className={styles.detailsTitleButtonWrapper}>
            <button
              type="submit"
              form="order-form"
              disabled={submitDisabled}
              className={cn(
                styles.detailsActionTitleButton,
                buttonStyles.btn,
                submitDisabled
                  ? buttonStyles.btnNeutral
                  : buttonStyles.btnSuccess
              )}
            >
              {header.title}
            </button>
          </div>

          <div className={styles.detailsActions} />
        </>
      )}

      {/* EDIT ORDER MODE */}
      {isOrderEdit && (
        <>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={cn(
              buttonStyles.btn,
              buttonStyles.btnNeutral,
              styles.backBtn
            )}
          >
            <span className={styles.backIcon}>
              <AppIcon name="arrowLeft" />
            </span>
            Назад
          </button>

          <div className={styles.detailsTitleButtonWrapper}>
            <button
              type="submit"
              form="order-form"
              disabled={submitDisabled}
              className={cn(
                styles.detailsActionTitleButton,
                buttonStyles.btn,
                submitDisabled
                  ? buttonStyles.btnNeutral
                  : buttonStyles.btnSuccess
              )}
            >
              {header.title} №{header.orderNumber}
            </button>
          </div>

          <div className={styles.detailsActions} />
        </>
      )}

      {/* PLOTS */}
      {isPlots && (
        <>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className={cn(
              buttonStyles.btn,
              buttonStyles.btnNeutral,
              styles.backBtn
            )}
          >
            <span className={styles.backIcon}>
              <AppIcon name="arrowLeft" />
            </span>
            Назад
          </button>

          <h1 className={styles.detailsTitle}>
            {header.title}
          </h1>

          <div className={cn(styles.detailsActions, styles.singleActionGroup)}>
            <button
              type="button"
              className={cn(
                buttonStyles.btn,
                buttonStyles.btnSuccess,
                styles.stretchActionButton
              )}
              onClick={openPlotCreateModal}
            >
              Добавить участок
            </button>
          </div>
        </>
      )}

      {/* USERS */}
      {isUsers && (
        <>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className={cn(
              buttonStyles.btn,
              buttonStyles.btnNeutral,
              styles.backBtn
            )}
          >
            <span className={styles.backIcon}>
              <AppIcon name="arrowLeft" />
            </span>
            Назад
          </button>

          <h1 className={styles.detailsTitle}>
            {header.title}
          </h1>

          <div className={cn(styles.detailsActions, styles.singleActionGroup)}>
            <button
              type="button"
              className={cn(
                buttonStyles.btn,
                buttonStyles.btnSuccess,
                styles.stretchActionButton
              )}
              onClick={() => {
                useUiStore.getState().openUserCreateModal()
              }}
            >
              Добавить пользователя
            </button>
          </div>
        </>
      )}

      {/* Admin режим (Users / Plots) */}
      {isAdminDetails && (
        <div className={styles.detailsContainer}>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className={cn(
              buttonStyles.btn,
              buttonStyles.btnNeutral,
              styles.backBtn
            )}
          >
            <span className={styles.backIcon}>
              <AppIcon name="arrowLeft" />
            </span>
            Назад
          </button>

          <h1 className={styles.detailsTitle}>
            {defaultTitle}
          </h1>
        </div>
      )}
      
      <span
        title={status}
        onClick={() => {
          if (status !== 'connecting') {
            signalRService.reconnect()
          }
        }}
        className={cn(
          styles.realtimeDot,
          status === 'connected' && styles.connected,
          status === 'connecting' && styles.connecting,
          status === 'disconnected' && styles.disconnected
        )}
      />
      {/* Модальное окно печати с выбором фото */}
      <PrintWithPhotosModal
        isOpen={printWithPhotosModalOpen}
        onClose={() => setPrintWithPhotosModalOpen(false)}
        onPrint={handlePrintWithPhotos}
        photos={orderData?.photos?.filter(p => Number(p.mediaType) === 0) || []}
        isLoading={isPrintingWithPhotos}
      />
    </header>
  );
}
